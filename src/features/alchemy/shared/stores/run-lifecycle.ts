import { getBattleStartPlayerHealth } from "@/lib/battle";
import { playDefeat, stopAllSfx } from "@/lib/audio";
import type { ActiveRunData } from "@/lib/active-run-session";
import type { Screen } from "@/lib/routing";
import type { TalentXP, UnlockedTalents } from "@/lib/game-data";
import { flushAlchemySaveNow } from "@/features/alchemy/shared/storage";
import { emptyInventory } from "@/lib/homestead/inventory";
import { logError } from "@/lib/error-logger";
import type { MaterialInventory } from "@/lib/homestead/types";
import { getRunSession } from "./run-reads";
import { encodeRunResumeSnapshot } from "./run-resume-codec";
import { dispatchRunSessionCommand, type GameplayDraft } from "./run-session-command";
import { initializeActiveBattle, setRunEndItems, setRunEndLabyrinthFloor } from "./run-session-write-port";
import {
  cloneRunObtainedItem,
  resetNavigation,
  resetProgress,
  setHasActiveBattle,
  setRunPlayerHealth,
} from "./write-port-run";
import { clearTransientSession, setHasActiveRun } from "./write-port-session";
import { applyTalentState, setFinishedRunCharacters } from "./write-port-meta";
import { applyRestoreRunToDraft, clearModeSlotInDraft } from "./run-park-restore";
import { touchRunRecency, type ParkedRunsMap } from "./parked-runs";
import type { ContentSystemId } from "@/lib/content-systems/types";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";
import { combineTrinketEffectIds } from "@/lib/trinkets";
import { useUiStore } from "./ui-store";

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

export function resolveActiveRunForSave(hasActiveRun: boolean, screen?: Screen): ActiveRunData | null {
  return hasActiveRun ? snapshotRun(screen) : null;
}

export function snapshotRun(screen?: Screen): ActiveRunData {
  return encodeRunResumeSnapshot(getRunSession(screen), screen);
}

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

export function syncBattleToRun(draft: GameplayDraft, options?: { playerHealth?: number }): void {
  const health = options?.playerHealth ?? draft.battle.battleState.playerHealth;
  setRunPlayerHealth(draft, health);
}

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

function flushSaveAfterRunEnd(): void {
  void flushAlchemySaveNow(null).catch((error: unknown) => {
    logError("Failed to flush save after run end", "storage", undefined, undefined, undefined, error);
  });
}

export function flushSaveAfterGearMutation(activeRun: ActiveRunData | null): void {
  void flushAlchemySaveNow(activeRun).catch((error: unknown) => {
    logError("Failed to flush save after gear mutation", "storage", undefined, undefined, undefined, error);
  });
}

function finalizeRunEndSessionState(
  options: {
    awardRunEndMaterials: (draft: GameplayDraft) => MaterialInventory;
    finalizeRunXP: (draft: GameplayDraft) => void;
  },
  draft: GameplayDraft,
): MaterialInventory {
  const session = draft.session;

  if (!session.hasActiveRun) {
    return emptyInventory();
  }

  const activeChar = draft.run.activeRun.characterId;
  setFinishedRunCharacters(draft, (prev) => {
    if (prev.includes(activeChar)) return prev;
    return [...prev, activeChar];
  });

  const materials = options.awardRunEndMaterials(draft);
  options.finalizeRunXP(draft);
  setRunEndItems(draft, draft.run.activeRun.runObtainedItems.map(cloneRunObtainedItem));
  if (draft.run.activeRun.contentSystemType === CONTENT_SYSTEMS.LABYRINTH) {
    const floor = draft.session.labyrinthMap?.currentFloor ?? null;
    setRunEndLabyrinthFloor(draft, floor);
  }

  clearModeSlotInDraft(draft, draft.run.activeRun.contentSystemType);
  setHasActiveRun(draft, false);
  return materials;
}

export function finalizeRunEndSession(options: {
  awardRunEndMaterials: (draft: GameplayDraft) => MaterialInventory;
  finalizeRunXP: (draft: GameplayDraft) => void;
}): MaterialInventory {
  return dispatchRunSessionCommand((draft) => finalizeRunEndSessionState(options, draft), {
    afterCommit: () => {
      flushSaveAfterRunEnd();
    },
  });
}

export function applyRunDefeatTeardown(options: {
  awardRunEndMaterials: (draft: GameplayDraft) => MaterialInventory;
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

export function clearBattleUi(): void {
  dispatchRunSessionCommand((draft) => setHasActiveBattle(draft, false));
  clearBattlePresentationUi();
}

export function clearBattlePresentationUi(): void {
  useUiStore.getState().clearCardHover();
  clearPresentationListeners.forEach((listener) => listener());
}

function notifyRunTeardown(): void {
  teardownListeners.forEach((listener) => listener());
}

function clearTransientUiOnTeardown(): void {
  useUiStore.getState().clearCardHover();
}
