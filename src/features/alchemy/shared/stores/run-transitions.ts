import { getBattleStartPlayerHealth } from "@/lib/battle";
import { playDefeat, stopAllSfx } from "@/lib/audio";
import { type ActiveRunData } from "@/lib/active-run-session";
import type { Screen } from "@/lib/routing";
import type { UnlockedTalents, TalentXP } from "@/lib/game-data";
import { flushAlchemySaveNow } from "@/features/alchemy/shared/storage/flush-save";
import { emptyInventory } from "@/lib/homestead/inventory";
import type { MaterialInventory } from "@/lib/homestead/types";
import { useUiStore } from "./ui-store";
import { getRunSession } from "./run-session-model";
import { encodeRunResumeSnapshot } from "./run-resume-codec";
import { dispatchRunSessionCommand, type GameplayDraft } from "./run-session-command";
import {
  createGameplayDraftProfileActions,
  createGameplayDraftRunActions,
  createGameplayDraftRunProfileActions,
  createGameplayDraftSessionActions,
} from "./gameplay-state-store";
import { initializeActiveBattle, setHasActiveBattle } from "./run-session-write-port";
import { rebindLiveRunMeta } from "./run-meta-rebind";
import { applyRestoreRunToDraft, clearModeSlotInDraft } from "./run-park-restore";
import { touchRunRecency, type ParkedRunsMap } from "./parked-runs";
import type { ContentSystemId } from "@/lib/content-systems/types";

/** Apply persisted active-run data across the run-lifetime stores atomically. */
export function restoreRun(
  activeRun: ActiveRunData | null,
  talentXP: TalentXP,
  unlockedTalents: UnlockedTalents,
  parkedRuns: ParkedRunsMap = {},
  runRecency: ContentSystemId[] = [],
): void {
  dispatchRunSessionCommand((draft) => {
    createGameplayDraftRunProfileActions(draft).applyTalentState(talentXP, unlockedTalents);
    draft.run.parkedRuns = { ...parkedRuns };
    draft.run.runRecency = [...runRecency];
    applyRestoreRunToDraft(draft, activeRun);
    if (activeRun) {
      draft.run.runRecency = touchRunRecency(draft.run.runRecency, activeRun.contentSystemType);
    }
  });
}

/** Active-run snapshot for autosave — null when the run has ended. */
export function resolveActiveRunForSave(hasActiveRun: boolean, screen?: Screen): ActiveRunData | null {
  return hasActiveRun ? snapshotRun(screen) : null;
}

/** Serialize the run-lifetime stores into persisted ActiveRunData. */
export function snapshotRun(screen?: Screen): ActiveRunData {
  return { ...encodeRunResumeSnapshot(getRunSession(screen), screen), runGold: 0 };
}

/** Rebind max HP and battle manifests after Armory mutations. */
export function syncRunMaxHealthFromGearMutation(draft: GameplayDraft): void {
  rebindLiveRunMeta(draft);
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
    if (draft.session.hasActiveRun) {
      clearModeSlotInDraft(draft, draft.run.activeRun.contentSystemType);
    }
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
function flushSaveAfterRunEnd(): void {
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

  clearModeSlotInDraft(draft, aggregate.run.activeRun.contentSystemType);
  sessionActions.setHasActiveRun(false);
  return materials;
}

/** Shared run-end bookkeeping: materials, XP, save flush, and clear active-run flag. */
export function finalizeRunEndSession(options: {
  awardRunEndMaterials: (draft: GameplayDraft, displayMaterials?: MaterialInventory | null) => MaterialInventory;
  finalizeRunXP: (draft: GameplayDraft) => void;
  displayMaterials?: MaterialInventory | null;
}): MaterialInventory {
  return dispatchRunSessionCommand((draft) => finalizeRunEndSessionState(options, draft), {
    afterCommit: () => {
      flushSaveAfterRunEnd();
    },
  });
}

/** Defeat flow: finalize rewards/XP and combat state in one commit, then run side effects. */
export function applyRunDefeatTeardown(options: {
  awardRunEndMaterials: (draft: GameplayDraft, displayMaterials?: MaterialInventory | null) => MaterialInventory;
  finalizeRunXP: (draft: GameplayDraft) => void;
  clearCombatState: (draft: GameplayDraft) => void;
  clearCombatPresentation?: () => void;
}): void {
  dispatchRunSessionCommand(
    (draft) => {
      finalizeRunEndSessionState(
        {
          awardRunEndMaterials: options.awardRunEndMaterials,
          finalizeRunXP: options.finalizeRunXP,
        },
        draft,
      );
      options.clearCombatState(draft);
    },
    {
      afterCommit: () => {
        flushSaveAfterRunEnd();
        stopAllSfx();
        playDefeat();
        options.clearCombatPresentation?.();
      },
    },
  );
}
