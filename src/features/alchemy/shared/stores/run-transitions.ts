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
import { getRunDomainStore, useRunDomainStore } from "./run-domain-store";
import { getRunProfileStore } from "./run-profile-store";
import { getRunTransientStore, resetRunTransientStore } from "./run-transient-store";
import { getRunBattleDomainStore, resetRunBattleDomainStore } from "./run-battle-domain-store";
import { createInitialRunDomainData } from "./run-domain-types";
import { clearBattlePresentationCardGhosts, resetBattlePresentation } from "./battle-presentation-bridge";
import { useUiStore } from "./ui-store";
import { useProfileStore } from "./profile-store";
import { getCommittedRunSession } from "./run-session-model";
import { restoreRunSession } from "./restore-active-run-session";
import { decodeRunResumeSnapshot, encodeRunResumeSnapshot } from "./run-resume-codec";
import { dispatchRunSessionCommand } from "./run-session-command";

/** Apply persisted active-run data across the run-lifetime stores atomically. */
export function restoreRun(
  activeRun: ActiveRunData | null,
  talentXP: TalentXP,
  unlockedTalents: UnlockedTalents,
): void {
  const decoded = activeRun ? decodeRunResumeSnapshot(activeRun) : null;
  dispatchRunSessionCommand(() => {
    const store = getRunDomainStore();
    if (decoded) store.initializeFromResumeSnapshot(decoded.progress);
    else store.initialize(null);
    getRunProfileStore().applyTalentState(talentXP, unlockedTalents);
    getRunBattleDomainStore().initializeActiveBattle(activeRun?.activeCombat?.battleState ?? null);

    if (decoded?.screen) store.setScreen(decoded.screen);
    if (!activeRun) return;

    const session = getRunTransientStore();
    // A resume is a full replacement of transient run state. Clearing first
    // prevents an in-process restore from leaking stale rewards or shop offers.
    session.clearTransientSession();
    session.setHasActiveRun(true);
    if (decoded) restoreRunSession(session, decoded.session);
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

  const store = getRunDomainStore();
  const nextMax = store.activeRun.runMaxHealth + delta;
  store.setRunMaxHealth(nextMax);
  store.setRunPlayerHealth(Math.min(nextMax, store.activeRun.runPlayerHealth));
}

/** Clamp run HP for battle entry and persist before creating BattleState. */
export function syncRunToBattleStart(playerHealth?: number): number {
  const store = getRunDomainStore();
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
  const health = options?.playerHealth ?? getRunBattleDomainStore().battleState.playerHealth;
  getRunDomainStore().setRunPlayerHealth(health);
}

/** Clear the battle-active flag and battle-related presentation state. */
export function clearBattleUi(): void {
  getRunBattleDomainStore().setHasActiveBattle(false);
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
    useRunDomainStore.setState((state) => {
      const fresh = createInitialRunDomainData();
      state.activeRun = { ...fresh.activeRun, characterId: state.activeRun.characterId };
      state.initialized = true;
      state.navigation = fresh.navigation;
    });
    resetRunTransientStore();
    resetRunBattleDomainStore();
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
  const session = getRunTransientStore();
  // Re-entry guard: run-end rewards are granted once per active run (menu abandon, defeat, victory).
  if (!session.hasActiveRun) {
    return emptyInventory();
  }

  const activeChar = getRunDomainStore().activeRun.characterId;
  useProfileStore.getState().setFinishedRunCharacters((prev) => {
    if (prev.includes(activeChar)) return prev;
    return [...prev, activeChar];
  });

  const materials = options.awardRunEndMaterials(options.displayMaterials);
  options.finalizeRunXP();

  getRunTransientStore().setHasActiveRun(false);
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
