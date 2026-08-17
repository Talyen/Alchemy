// Atomic run lifecycle transitions across the run-domain, profile, transient, and battle stores.
import { getBattleStartPlayerHealth, repairPersistedBattleTrinketManifest } from "@/lib/battle";
import { playDefeat, stopAllSfx } from "@/lib/audio";
import { type ActiveRunData } from "@/lib/active-run-session";
import { ROUTE_SCREENS, type Screen } from "@/lib/routing";
import type { CharacterId, UnlockedTalents, TalentXP } from "@/lib/game-data";
import { computeGearManifest, type GearInstance, type GearLoadouts } from "@/lib/gear";
import {
  eventHasUnresolvedRandomTrinket,
  pickMysteryEvent,
  repairUnresolvedMysteryTrinkets,
  resolveMysteryEventTrinkets,
} from "@/lib/mystery";
import { flushAlchemySaveNow } from "@/features/alchemy/shared/storage/flush-save";
import { emptyInventory } from "@/lib/homestead/inventory";
import type { MaterialInventory } from "@/lib/homestead/types";
import { useUiStore } from "./ui-store";
import { getRunSession } from "./run-session-model";
import { restoreRunSession } from "./restore-active-run-session";
import { decodeRunResumeSnapshot, encodeRunResumeSnapshot } from "./run-resume-codec";
import { inferActiveRunScreen } from "./encode-interrupted-flow";
import { dispatchRunSessionCommand, type GameplayDraft } from "./run-session-command";
import {
  createGameplayDraftProfileActions,
  createGameplayDraftRunActions,
  createGameplayDraftRunProfileActions,
  createGameplayDraftSessionActions,
} from "./gameplay-state-store";
import {
  abandonMysteryDestinationVisit,
  clearMysteryVisitState,
  createDraftRunRandomSource,
  initializeActiveBattle,
  setHasActiveBattle,
  setMysteryEvent,
} from "./run-session-write-port";

/** Apply persisted active-run data across the run-lifetime stores atomically. */
export function restoreRun(
  activeRun: ActiveRunData | null,
  talentXP: TalentXP,
  unlockedTalents: UnlockedTalents,
): void {
  const decoded = activeRun ? decodeRunResumeSnapshot(activeRun) : null;
  dispatchRunSessionCommand((draft) => {
    const run = createGameplayDraftRunActions(draft);
    const runProfile = createGameplayDraftRunProfileActions(draft);
    const session = createGameplayDraftSessionActions(draft);
    if (decoded) run.initializeFromResumeSnapshot(decoded.progress);
    else run.initialize(null);
    runProfile.applyTalentState(talentXP, unlockedTalents);
    const battleState =
      activeRun?.activeCombat?.battleState != null
        ? repairPersistedBattleTrinketManifest(activeRun.activeCombat.battleState, activeRun.runTrinkets)
        : null;
    const pending = decoded?.pendingBattleTransition ?? null;
    initializeActiveBattle(draft, battleState, pending);

    const resumeScreen = decoded?.screen ?? (activeRun ? inferActiveRunScreen(activeRun) : null);
    if (resumeScreen) run.setScreen(resumeScreen);
    if (!activeRun) return;

    const transient = session;
    // A resume is a full replacement of transient run state. Clearing first
    // prevents an in-process restore from leaking stale rewards or shop offers.
    transient.clearTransientSession();
    transient.setHasActiveRun(true);
    if (decoded) restoreRunSession(transient, decoded.session);
    if (draft.session.mysteryEvent && eventHasUnresolvedRandomTrinket(draft.session.mysteryEvent)) {
      const rng = createDraftRunRandomSource(draft, "events");
      setMysteryEvent(
        draft,
        repairUnresolvedMysteryTrinkets(draft.session.mysteryEvent, draft.run.activeRun.runTrinkets, rng),
      );
    }
    if (resumeScreen === "mystery" && !draft.session.mysteryEvent) {
      if (activeRun.mysteryVisit != null) {
        abandonMysteryDestinationVisit(draft);
        clearMysteryVisitState(draft);
        run.setScreen(ROUTE_SCREENS.DESTINATION);
        return;
      }
      const rng = createDraftRunRandomSource(draft, "events");
      setMysteryEvent(draft, resolveMysteryEventTrinkets(pickMysteryEvent(rng), draft.run.activeRun.runTrinkets, rng));
    }
  });
}

/** Active-run snapshot for autosave — null when the run has ended. */
export function resolveActiveRunForSave(hasActiveRun: boolean, screen?: Screen): ActiveRunData | null {
  return hasActiveRun ? snapshotRun(screen) : null;
}

/** Serialize the run-lifetime stores into persisted ActiveRunData. */
export function snapshotRun(screen?: Screen): ActiveRunData {
  return encodeRunResumeSnapshot(getRunSession(screen), screen);
}

/** Apply gear max-health bonus delta after armory gear inventory/loadout mutations during an active run. */
export function syncRunMaxHealthFromGearMutation(
  draft: GameplayDraft,
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

  const run = createGameplayDraftRunActions(draft);
  const nextMax = draft.run.activeRun.runMaxHealth + delta;
  run.setRunMaxHealth(nextMax);
  run.setRunPlayerHealth(Math.min(nextMax, draft.run.activeRun.runPlayerHealth));
}

/** Clamp run HP for battle entry and persist before creating BattleState. */
export function syncRunToBattleStart(draft: GameplayDraft, playerHealth?: number): number {
  const run = createGameplayDraftRunActions(draft);
  const startingHealth =
    playerHealth ??
    getBattleStartPlayerHealth(
      draft.run.activeRun.runPlayerHealth,
      draft.run.activeRun.runMaxHealth,
      draft.run.activeRun.runTrinkets,
    );
  run.setRunPlayerHealth(startingHealth);
  return startingHealth;
}

/** Persist combat HP to run progress after victory or when leaving battle. */
export function syncBattleToRun(draft: GameplayDraft, options?: { playerHealth?: number }): void {
  const health = options?.playerHealth ?? draft.battle.battleState.playerHealth;
  createGameplayDraftRunActions(draft).setRunPlayerHealth(health);
}

type LifecycleListener = () => void;
const teardownListeners = new Set<LifecycleListener>();
const clearPresentationListeners = new Set<LifecycleListener>();

export function onRunTeardown(listener: LifecycleListener): () => void {
  teardownListeners.add(listener);
  return () => {
    teardownListeners.delete(listener);
  };
}

export function onClearBattlePresentation(listener: LifecycleListener): () => void {
  clearPresentationListeners.add(listener);
  return () => {
    clearPresentationListeners.delete(listener);
  };
}

/** Clear the battle-active flag and battle-related presentation state. */
export function clearBattleUi(): void {
  dispatchRunSessionCommand((draft) => setHasActiveBattle(draft, false));
  clearBattlePresentationUi();
}

/** Clear battle presentation after the gameplay commit that ended combat. */
export function clearBattlePresentationUi(): void {
  useUiStore.getState().clearCardHover();
  clearPresentationListeners.forEach((listener) => listener());
}

/** Clear active combat, run progression, session UI, navigation, and presentation (profile survives). */
export function teardownRun(): void {
  dispatchRunSessionCommand((draft) => {
    const run = createGameplayDraftRunActions(draft);
    const session = createGameplayDraftSessionActions(draft);
    run.resetProgress();
    run.resetNavigation();
    session.clearTransientSession();
    initializeActiveBattle(draft, null);
  });
  useUiStore.getState().clearCardHover();
  teardownListeners.forEach((listener) => listener());
}

/** Write the full save file immediately (bypasses autosave debounce). */
async function flushPersistedSave(activeRun: ActiveRunData | null): Promise<void> {
  await flushAlchemySaveNow(activeRun);
}

/** Persist meta/talent progress after a run ends with no resumable active run. */
export function flushSaveAfterRunEnd(): void {
  void flushPersistedSave(null);
}

/** Persist immediately after a gear mutation (bypasses autosave debounce). */
export function flushSaveAfterGearMutation(activeRun: ActiveRunData | null): void {
  void flushPersistedSave(activeRun);
}

/** Apply run-end bookkeeping mutations without opening or flushing a transaction. */
function finalizeRunEndSessionState(
  options: {
    awardRunEndMaterials: (draft: GameplayDraft, displayMaterials?: MaterialInventory | null) => MaterialInventory;
    finalizeRunXP: (draft: GameplayDraft) => void;
    displayMaterials?: MaterialInventory | null;
  },
  draft: GameplayDraft,
): MaterialInventory {
  const aggregate = draft;
  const profile = createGameplayDraftProfileActions(draft);
  const sessionActions = createGameplayDraftSessionActions(draft);
  const session = aggregate.session;
  // Re-entry guard: run-end rewards are granted once per active run (menu abandon, defeat, victory).
  if (!session.hasActiveRun) {
    return emptyInventory();
  }

  const activeChar = aggregate.run.activeRun.characterId;
  profile.setFinishedRunCharacters((prev) => {
    if (prev.includes(activeChar)) return prev;
    return [...prev, activeChar];
  });

  const materials = options.awardRunEndMaterials(draft, options.displayMaterials);
  options.finalizeRunXP(draft);

  if (aggregate.run.activeRun.contentSystemType !== "wildwood") {
    draft.runProfile.gold = aggregate.run.activeRun.runGold;
  }

  sessionActions.setHasActiveRun(false);
  return materials;
}

/** Shared run-end bookkeeping: materials, XP, save flush, and clear active-run flag. */
export function finalizeRunEndSession(options: {
  awardRunEndMaterials: (draft: GameplayDraft, displayMaterials?: MaterialInventory | null) => MaterialInventory;
  finalizeRunXP: (draft: GameplayDraft) => void;
  displayMaterials?: MaterialInventory | null;
}): MaterialInventory {
  const materials = dispatchRunSessionCommand((draft) => finalizeRunEndSessionState(options, draft));
  flushSaveAfterRunEnd();
  return materials;
}

/** Defeat flow: finalize rewards/XP and combat state in one commit, then run side effects. */
export function applyRunDefeatTeardown(options: {
  awardRunEndMaterials: (draft: GameplayDraft, displayMaterials?: MaterialInventory | null) => MaterialInventory;
  finalizeRunXP: (draft: GameplayDraft) => void;
  clearCombatState: (draft: GameplayDraft) => void;
  clearCombatPresentation?: () => void;
}): void {
  dispatchRunSessionCommand((draft) => {
    finalizeRunEndSessionState(
      {
        awardRunEndMaterials: options.awardRunEndMaterials,
        finalizeRunXP: options.finalizeRunXP,
      },
      draft,
    );
    options.clearCombatState(draft);
  });
  flushSaveAfterRunEnd();
  stopAllSfx();
  playDefeat();
  options.clearCombatPresentation?.();
}
