import { getBattleStartPlayerHealth } from "@/lib/battle";
import { playDefeat, stopAllSfx } from "@/lib/audio";
import type { ActiveRunData } from "@/lib/active-run-session";
import type { Screen } from "@/lib/routing";
import type { TalentXP, UnlockedTalents } from "@/lib/game-data";
import { flushAlchemySaveNow } from "@/features/alchemy/shared/storage/flush-save";
import { emptyInventory } from "@/lib/homestead/inventory";
import type { MaterialInventory } from "@/lib/homestead/types";
import { getRunSession } from "./run-session-model";
import { encodeRunResumeSnapshot } from "./run-resume-codec";
import { dispatchRunSessionCommand, type GameplayDraft } from "./run-session-command";
import { initializeActiveBattle, setRunEndItems, setRunEndLabyrinthFloor } from "./run-session-write-port";
import { cloneRunObtainedItem, resetNavigation, resetProgress, setRunPlayerHealth } from "./write-port-run";
import { clearTransientSession, setHasActiveRun } from "./write-port-session";
import { applyTalentState, setFinishedRunCharacters } from "./write-port-profile";
import { applyRestoreRunToDraft, clearModeSlotInDraft } from "./run-park-restore";
import { touchRunRecency, type ParkedRunsMap } from "./parked-runs";
import type { ContentSystemId } from "@/lib/content-systems/types";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";
import { combineTrinketEffectIds } from "@/lib/trinkets";
import { clearTransientUiOnTeardown, notifyRunTeardown } from "./run-presentation-lifecycle";

/** Apply persisted active-run data across the run-lifetime stores atomically. */
export function restoreRun(
  activeRun: ActiveRunData | null,
  talentXP: TalentXP,
  unlockedTalents: UnlockedTalents,
  parkedRuns: ParkedRunsMap = {},
  runRecency: ContentSystemId[] = [],
): void {
  dispatchRunSessionCommand((draft) => {
    applyTalentState(draft, talentXP, unlockedTalents);
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
  return encodeRunResumeSnapshot(getRunSession(screen), screen);
}

/** Clamp run HP for battle entry and persist before creating BattleState. */
export function syncRunToBattleStart(draft: GameplayDraft, playerHealth?: number): number {
  const startingHealth =
    playerHealth ??
    getBattleStartPlayerHealth(
      draft.run.activeRun.runPlayerHealth,
      draft.run.activeRun.runMaxHealth,
      combineTrinketEffectIds(
        draft.run.activeRun.runBoons,
        draft.gear.equippedTrinkets[draft.run.activeRun.characterId],
      ),
    );
  setRunPlayerHealth(draft, startingHealth);
  return startingHealth;
}

/** Persist combat HP to run progress after victory or when leaving battle. */
export function syncBattleToRun(draft: GameplayDraft, options?: { playerHealth?: number }): void {
  const health = options?.playerHealth ?? draft.battle.battleState.playerHealth;
  setRunPlayerHealth(draft, health);
}

/** Clear active combat, run progression, session UI, navigation, and presentation (profile survives). */
export function teardownRun(): void {
  dispatchRunSessionCommand((draft) => {
    if (draft.session.hasActiveRun) {
      clearModeSlotInDraft(draft, draft.run.activeRun.contentSystemType);
    }
    resetProgress(draft);
    resetNavigation(draft);
    clearTransientSession(draft);
    initializeActiveBattle(draft, null);
  });
  clearTransientUiOnTeardown();
  notifyRunTeardown();
}

/** Persist meta/talent progress after a run ends with no resumable active run. */
function flushSaveAfterRunEnd(): void {
  void flushAlchemySaveNow(null).catch((error: unknown) => {
    console.error("Failed to flush save after run end", error);
  });
}

/** Persist immediately after a gear mutation (bypasses autosave debounce). */
export function flushSaveAfterGearMutation(activeRun: ActiveRunData | null): void {
  void flushAlchemySaveNow(activeRun).catch((error: unknown) => {
    console.error("Failed to flush save after gear mutation", error);
  });
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
  const session = draft.session;
  // Re-entry guard: run-end rewards are granted once per active run (menu abandon, defeat, victory).
  if (!session.hasActiveRun) {
    return emptyInventory();
  }

  const activeChar = draft.run.activeRun.characterId;
  setFinishedRunCharacters(draft, (prev) => {
    if (prev.includes(activeChar)) return prev;
    return [...prev, activeChar];
  });

  const materials = options.awardRunEndMaterials(draft, options.displayMaterials);
  options.finalizeRunXP(draft);
  setRunEndItems(draft, draft.run.activeRun.runObtainedItems.map(cloneRunObtainedItem));
  if (draft.run.activeRun.contentSystemType === CONTENT_SYSTEMS.LABYRINTH) {
    setRunEndLabyrinthFloor(draft, draft.session.labyrinthMap.currentFloor);
  }

  clearModeSlotInDraft(draft, draft.run.activeRun.contentSystemType);
  setHasActiveRun(draft, false);
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
