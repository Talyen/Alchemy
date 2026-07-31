// Atomic run lifecycle transitions across the run-domain, profile, transient, and battle stores.
import { getBattleStartPlayerHealth } from "@/lib/battle";
import { playDefeat, stopAllSfx } from "@/lib/audio";
import { type ActiveRunData } from "@/lib/active-run-session";
import type { Screen } from "@/lib/routing";
import type { CharacterId, UnlockedTalents, TalentXP } from "@/lib/game-data";
import { computeGearManifest, type GearInstance, type GearLoadouts } from "@/lib/gear";
import { flushAlchemySaveNow } from "@/features/alchemy/shared/storage/flush-save";
import { emptyInventory } from "@/lib/homestead/inventory";
import type { MaterialInventory } from "@/lib/homestead/types";
import { clearBattlePresentationCardGhosts, resetBattlePresentation } from "./battle-presentation-bridge";
import { useUiStore } from "./ui-store";
import { getCommittedRunSession } from "./run-session-model";
import { restoreRunSession } from "./restore-active-run-session";
import { decodeRunResumeSnapshot, encodeRunResumeSnapshot } from "./run-resume-codec";
import { dispatchRunSessionCommand } from "./run-session-command";
import { createRunSessionStoreSnapshot } from "./run-session-queries";

/** Apply persisted active-run data across the run-lifetime stores atomically. */
export function restoreRun(
  activeRun: ActiveRunData | null,
  talentXP: TalentXP,
  unlockedTalents: UnlockedTalents,
): void {
  const decoded = activeRun ? decodeRunResumeSnapshot(activeRun) : null;
  dispatchRunSessionCommand(() => {
    const session = createRunSessionStoreSnapshot();
    if (decoded) session.domain.initializeFromResumeSnapshot(decoded.progress);
    else session.domain.initialize(null);
    session.runProfile.applyTalentState(talentXP, unlockedTalents);
    session.battle.initializeActiveBattle(activeRun?.activeCombat?.battleState ?? null);

    if (decoded?.screen) session.domain.setScreen(decoded.screen);
    if (!activeRun) return;

    const transient = session.transient;
    // A resume is a full replacement of transient run state. Clearing first
    // prevents an in-process restore from leaking stale rewards or shop offers.
    transient.clearTransientSession();
    transient.setHasActiveRun(true);
    if (decoded) restoreRunSession(transient, decoded.session);
  });
}

/** Active-run snapshot for autosave — null when the run has ended. */
export function resolveActiveRunForSave(hasActiveRun: boolean, screen?: Screen): ActiveRunData | null {
  return hasActiveRun ? snapshotRun(screen) : null;
}

/** Serialize the run-lifetime stores into persisted ActiveRunData. */
export function snapshotRun(screen?: Screen): ActiveRunData {
  return encodeRunResumeSnapshot(getCommittedRunSession(screen), screen);
}

/** Apply gear max-health bonus delta after armory gear inventory/loadout mutations during an active run. */
export function syncRunMaxHealthFromGearMutation(
  characterId: CharacterId,
  inventoryBefore: GearInstance[],
  loadoutsBefore: GearLoadouts,
  inventoryAfter: GearInstance[],
  loadoutsAfter: GearLoadouts,
): void {
  const oldBonus = computeGearManifest(characterId, inventoryBefore, loadoutsBefore).maxHealth;
  const newBonus = computeGearManifest(characterId, inventoryAfter, loadoutsAfter).maxHealth;
  const delta = newBonus - oldBonus;
  if (delta === 0) return;

  const store = createRunSessionStoreSnapshot().domain;
  const nextMax = store.activeRun.runMaxHealth + delta;
  store.setRunMaxHealth(nextMax);
  store.setRunPlayerHealth(Math.min(nextMax, store.activeRun.runPlayerHealth));
}

/** Clamp run HP for battle entry and persist before creating BattleState. */
export function syncRunToBattleStart(playerHealth?: number): number {
  const store = createRunSessionStoreSnapshot().domain;
  const startingHealth =
    playerHealth ??
    getBattleStartPlayerHealth(
      store.activeRun.runPlayerHealth,
      store.activeRun.runMaxHealth,
      store.activeRun.runTrinkets,
    );
  store.setRunPlayerHealth(startingHealth);
  return startingHealth;
}

/** Persist combat HP to run progress after victory or when leaving battle. */
export function syncBattleToRun(options?: { playerHealth?: number }): void {
  const session = createRunSessionStoreSnapshot();
  const health = options?.playerHealth ?? session.battle.battleState.playerHealth;
  session.domain.setRunPlayerHealth(health);
}

/** Clear the battle-active flag and battle-related presentation state. */
export function clearBattleUi(): void {
  createRunSessionStoreSnapshot().battle.setHasActiveBattle(false);
  clearBattlePresentationUi();
}

/** Clear battle presentation after the gameplay commit that ended combat. */
export function clearBattlePresentationUi(): void {
  useUiStore.getState().clearCardHover();
  clearBattlePresentationCardGhosts();
}

/** Clear active combat, run progression, session UI, navigation, and presentation (profile survives). */
export function teardownRun(): void {
  dispatchRunSessionCommand(() => {
    const session = createRunSessionStoreSnapshot();
    session.domain.resetProgress();
    session.domain.resetNavigation();
    session.transient.clearTransientSession();
    session.battle.initializeActiveBattle(null);
  });
  resetBattlePresentation();
  useUiStore.getState().clearCardHover();
}

/** Write the full save file immediately (bypasses autosave debounce). */
async function flushPersistedSave(activeRun: ActiveRunData | null): Promise<void> {
  await flushAlchemySaveNow(activeRun);
}

/** Persist meta/talent progress after a run ends with no resumable active run. */
export function flushSaveAfterRunEnd(): void {
  void flushPersistedSave(null);
}

/** Apply run-end bookkeeping mutations without opening or flushing a transaction. */
function finalizeRunEndSessionState(options: {
  awardRunEndMaterials: (displayMaterials?: MaterialInventory | null) => MaterialInventory;
  finalizeRunXP: () => void;
  displayMaterials?: MaterialInventory | null;
}): MaterialInventory {
  const aggregate = createRunSessionStoreSnapshot();
  const session = aggregate.transient;
  // Re-entry guard: run-end rewards are granted once per active run (menu abandon, defeat, victory).
  if (!session.hasActiveRun) {
    return emptyInventory();
  }

  const activeChar = aggregate.domain.activeRun.characterId;
  aggregate.profile.setFinishedRunCharacters((prev) => {
    if (prev.includes(activeChar)) return prev;
    return [...prev, activeChar];
  });

  const materials = options.awardRunEndMaterials(options.displayMaterials);
  options.finalizeRunXP();

  session.setHasActiveRun(false);
  return materials;
}

/** Shared run-end bookkeeping: materials, XP, save flush, and clear active-run flag. */
export function finalizeRunEndSession(options: {
  awardRunEndMaterials: (displayMaterials?: MaterialInventory | null) => MaterialInventory;
  finalizeRunXP: () => void;
  displayMaterials?: MaterialInventory | null;
}): MaterialInventory {
  const materials = dispatchRunSessionCommand(() => finalizeRunEndSessionState(options));
  flushSaveAfterRunEnd();
  return materials;
}

/** Defeat flow: finalize rewards/XP and combat state in one commit, then run side effects. */
export function applyRunDefeatTeardown(options: {
  awardRunEndMaterials: (displayMaterials?: MaterialInventory | null) => MaterialInventory;
  finalizeRunXP: () => void;
  clearCombatState: () => void;
  clearCombatPresentation?: () => void;
}): void {
  dispatchRunSessionCommand(() => {
    finalizeRunEndSessionState({
      awardRunEndMaterials: options.awardRunEndMaterials,
      finalizeRunXP: options.finalizeRunXP,
    });
    options.clearCombatState();
  });
  flushSaveAfterRunEnd();
  stopAllSfx();
  playDefeat();
  options.clearCombatPresentation?.();
}
