import { buildAlchemySaveDataFromStores } from "../storage/persistence";
import { saveAlchemySaveData } from "../storage/io";
import { sessionFeedback } from "@/features/alchemy/shared/stores/session-capabilities";
import type { ActiveRunData, RunRecap } from "@/lib/active-run-session";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";
import type { TalentXP, UnlockedTalents } from "@/lib/game-data";
import { isEditionRunAvailable } from "@/lib/game-edition";
import { emptyInventory } from "@/lib/homestead/inventory";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { Screen } from "@/lib/routing";
import { logStorageFailure } from "@/lib/storage-logging";
import { current, isDraft } from "immer";
import type { GameSession } from "./game-session-types";
import { dispatchGameplayCommand, type GameplayDraft } from "./gameplay-command";
import { getRunSession, readRunResumeScreen } from "./run-reads";
import { applyRestoreRunToDraft } from "./run-restore";
import { encodeRunResumeSnapshot } from "./run-resume-codec";
import type { RunTransaction } from "./run-session-command";
import { acceptCommand, rejectCommand } from "./run-session-command";
import {
  applyTalentState,
  captureRunRecap,
  clearTransientSession,
  cloneRunObtainedItem,
  resetNavigation,
  resetProgress,
  setFinishedRunCharacters,
  setHasActiveRun,
  setRunEndCurrencies,
  setRunEndItems,
  setRunEndLabyrinthFloor,
  setRunEndMaterials,
  setRunPlayerHealth,
} from "./run-session-write-port";
import { sessionRuntime } from "./session-runtime";
import { openRunTransaction } from "./transaction-internal";

export function restoreRun(
  activeRun: ActiveRunData | null,
  talentXP: TalentXP,
  unlockedTalents: UnlockedTalents,
  gameSession: GameSession,
): void {
  dispatchGameplayCommand(
    (draft) => {
      applyTalentState(draft, talentXP, unlockedTalents);
      applyRestoreRunToDraft(draft, activeRun && isEditionRunAvailable(activeRun) ? activeRun : null);

      return acceptCommand();
    },
    undefined,
    gameSession,
  );
}

export function resolveActiveRunForSave(
  hasActiveRun: boolean,
  screen: Screen | undefined,
  gameSession: GameSession,
): ActiveRunData | null {
  return hasActiveRun ? snapshotRun(screen, gameSession) : null;
}

export function snapshotRun(screen: Screen | undefined, gameSession: GameSession): ActiveRunData {
  return encodeRunResumeSnapshot(
    getRunSession(undefined, gameSession),
    screen ?? readRunResumeScreen(gameSession) ?? undefined,
  );
}

export function syncRunToBattleStart(draft: RunTransaction, playerHealth?: number): number {
  const startingHealth = playerHealth ?? draft.run.activeRun.runPlayerHealth;
  setRunPlayerHealth(draft, startingHealth);
  return startingHealth;
}

export function syncBattleToRun(draft: RunTransaction, options?: { playerHealth?: number }): void {
  const health =
    options?.playerHealth ??
    (draft.session.activity.kind === "battle" ? draft.session.activity.data.battleState.playerHealth : null);
  if (health === null) throw new Error("Battle Health synchronization requires an active battle");
  setRunPlayerHealth(draft, health);
}

export function clearActiveRunInDraft(draft: GameplayDraft): void {
  resetProgress(draft);
  resetNavigation(draft);
  clearTransientSession(draft);
}

export function teardownRun(gameSession: GameSession): void {
  dispatchGameplayCommand(
    (draft) => {
      clearActiveRunInDraft(draft);

      return acceptCommand();
    },
    undefined,
    gameSession,
  );
  clearBattleUiState(gameSession);
  notifyRunTeardown(gameSession);
}

function flushSave(activeRun: ActiveRunData | null, message: string, gameSession: GameSession): void {
  // Immediate fast path: run-end and gear mutations need durability without
  // waiting for the autosave debounce. Shares the storage owner’s queue (and the
  // snapshot builder) with the debounced autosave, so overlapping writes
  // coalesce. saveAlchemySaveData never rejects (failures resolve "failed"),
  // so handle the outcome explicitly: the debounced scheduler write scheduled
  // by the same store commit retries on failure. The rejection handler is
  // defensive only, so an unexpected throw still reports instead of going
  // unhandled.
  void saveAlchemySaveData(buildAlchemySaveDataFromStores(activeRun, gameSession), gameSession).then(
    (outcome) => {
      if (outcome === "failed") logStorageFailure(message);
    },
    (error: unknown) => {
      logStorageFailure(message, error);
    },
  );
}

function flushSaveAfterRunEnd(gameSession: GameSession): void {
  flushSave(null, "Failed to flush save after run end", gameSession);
}

export function flushSaveAfterGearMutation(activeRun: ActiveRunData | null, gameSession: GameSession): void {
  flushSave(activeRun, "Failed to flush save after gear mutation", gameSession);
}

function finalizeRunEndSessionState(
  options: {
    awardRunEndMaterials: (transaction: RunTransaction) => MaterialInventory;
    finalizeRunXP: (transaction: RunTransaction) => void;
  },
  draft: GameplayDraft,
  ending: RunRecap["ending"],
): MaterialInventory {
  const session = draft.session;

  if (session.activity.kind === "inactive") {
    return emptyInventory();
  }

  const activeChar = draft.run.activeRun.characterId;
  setFinishedRunCharacters(draft, (prev) => {
    if (prev.includes(activeChar)) return prev;
    return [...prev, activeChar];
  });

  const scope = openRunTransaction(draft);
  let homesteadBonus: MaterialInventory;
  try {
    homesteadBonus = options.awardRunEndMaterials(scope.transaction);
    captureRunRecap(draft, ending);
    options.finalizeRunXP(scope.transaction);
  } finally {
    scope.close();
  }
  setRunEndItems(draft, draft.run.activeRun.runObtainedItems.map(cloneRunObtainedItem));
  if (draft.run.activeRun.contentSystemType === CONTENT_SYSTEMS.LABYRINTH) {
    const floor = draft.session.labyrinthMap?.currentFloor ?? null;
    setRunEndLabyrinthFloor(draft, floor);
  }

  setHasActiveRun(draft, false);
  return homesteadBonus;
}

export function finalizeRunEndSession(
  options: {
    awardRunEndMaterials: (transaction: RunTransaction) => MaterialInventory;
    finalizeRunXP: (transaction: RunTransaction) => void;
  },
  gameSession: GameSession,
): MaterialInventory {
  return dispatchGameplayCommand(
    (draft) => acceptCommand(finalizeRunEndSessionState(options, draft, "victory")),
    {
      afterCommit: () => {
        flushSaveAfterRunEnd(gameSession);
      },
    },
    gameSession,
  );
}

/** Manual termination shares earned progression, but does not simulate a defeat. */
export function abandonRun(
  options: {
    awardRunEndMaterials: (transaction: RunTransaction) => MaterialInventory;
    finalizeRunXP: (transaction: RunTransaction) => void;
  },
  gameSession: GameSession,
): boolean {
  return dispatchGameplayCommand(
    (draft) => {
      if (draft.session.activity.kind === "inactive") return rejectCommand("There is no active run to abandon", false);
      finalizeRunEndSessionState(options, draft, "abandoned");
      // The battle route retains its outgoing display; ending activity removes
      // command access to combat immediately. Preserve the recap
      // snapshot: manual End Run always shows the End Run screen. Copy the
      // values first so the recap never holds revoked draft proxies.
      const runRecap = isDraft(draft.session.runRecap) ? current(draft.session.runRecap) : draft.session.runRecap;
      const runEndMaterials = { ...draft.session.runEndMaterials };
      const runEndCurrencies = { ...draft.session.runEndCurrencies };
      const runEndTalentXP = { ...draft.session.runEndTalentXP };
      const runEndItems = draft.session.runEndItems.map(cloneRunObtainedItem);
      const runEndLabyrinthFloor = draft.session.runEndLabyrinthFloor;
      clearTransientSession(draft);
      draft.session.runRecap = runRecap;
      setRunEndMaterials(draft, runEndMaterials);
      setRunEndCurrencies(draft, runEndCurrencies);
      // No write-port setter: finalizeRunXP owns runEndTalentXP.
      draft.session.runEndTalentXP = runEndTalentXP;
      setRunEndItems(draft, runEndItems);
      setRunEndLabyrinthFloor(draft, runEndLabyrinthFloor);
      return acceptCommand(true);
    },
    {
      afterCommit: () => {
        sessionFeedback(gameSession).stopAllSfx();
        clearBattlePresentationUi(gameSession);
        notifyRunTeardown(gameSession);
        flushSaveAfterRunEnd(gameSession);
      },
    },
    gameSession,
  );
}

export function applyRunDefeatTeardown(
  options: {
    awardRunEndMaterials: (transaction: RunTransaction) => MaterialInventory;
    finalizeRunXP: (transaction: RunTransaction) => void;
    clearCombatPresentation?: () => void;
  },
  gameSession: GameSession,
): void {
  dispatchGameplayCommand(
    (draft) => {
      finalizeRunEndSessionState(
        {
          awardRunEndMaterials: options.awardRunEndMaterials,
          finalizeRunXP: options.finalizeRunXP,
        },
        draft,
        "death",
      );
      return acceptCommand();
    },
    {
      afterCommit: () => {
        flushSaveAfterRunEnd(gameSession);
        sessionFeedback(gameSession).stopAllSfx();
        sessionFeedback(gameSession).playDefeat();
        options.clearCombatPresentation?.();
      },
    },
    gameSession,
  );
}

export function onRunTeardown(listener: () => void, gameSession: GameSession): () => void {
  const runtime = sessionRuntime(gameSession);
  return runtime.track(runtime.teardown.on(listener));
}
export function onClearBattlePresentation(listener: () => void, gameSession: GameSession): () => void {
  const runtime = sessionRuntime(gameSession);
  return runtime.track(runtime.clearPresentation.on(listener));
}

function clearBattleUiState(gameSession: GameSession): void {
  sessionRuntime(gameSession).feedback.clearBattleUi();
}
export function clearBattlePresentationUi(gameSession: GameSession): void {
  clearBattleUiState(gameSession);
  sessionRuntime(gameSession).clearPresentation.emit();
}
function notifyRunTeardown(gameSession: GameSession): void {
  sessionRuntime(gameSession).teardown.emit();
}
