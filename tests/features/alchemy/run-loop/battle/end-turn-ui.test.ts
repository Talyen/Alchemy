import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import { clearBattleStageMarks, battleStageMarkName } from "@/lib/performance/battle-stage-marks";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createBattleEndTurnUi } from "@/features/alchemy/run-loop/battle/end-turn-ui";
import type { BattleControllerContext } from "@/features/alchemy/run-loop/battle/battle-context";
import type { createBattleSession } from "@/features/alchemy/run-loop/battle/battle-session";
import type { createBattleTransferDeps } from "@/features/alchemy/run-loop/battle/battle-transfer-deps";
import { makeTestBattleState } from "../../../../fixtures/battle";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { setSyncedBattleState } from "@/features/alchemy/shared/stores/run-session-write-port";
import { resetBattlePresentationAndRun } from "./battle-test-reset";
import { useBattlePresentationStore } from "@/features/alchemy/run-loop/battle/battle-presentation-store";

const { resolveEndTurnMock } = vi.hoisted(() => ({
  resolveEndTurnMock: vi.fn(() => false),
}));

vi.mock("@/features/alchemy/run-loop/battle/turn-orchestration", () => ({
  resolveEndTurn: resolveEndTurnMock,
  createTurnOrchestration: () => ({
    logBattleError: vi.fn(),
    resetHandTransferUi: vi.fn(),
    getPresentation: vi.fn(),
  }),
  resumePendingBattleTransition: vi.fn(),
}));

vi.mock("@/lib/animation/animation-prefs", () => ({
  isAnimationDisabled: () => false,
}));

describe("createBattleEndTurnUi handleEndTurn", () => {
  beforeEach(() => {
    resetBattlePresentationAndRun();
    useUiStore.getState().setCardInspection(null);
    resolveEndTurnMock.mockClear();
    resolveEndTurnMock.mockReturnValue(false);
  });

  function makeUi(options?: { discardDelay?: Promise<void> }) {
    const cardPlayInProgressRef = { current: false };
    const clearAutoEndTurn = vi.fn();
    const battleSessionRef = { current: 1 };
    const battleState = makeTestBattleState({
      turnPhase: "player",
      hand: [],
      enemyHealth: 20,
      playerHealth: 30,
    });
    dispatchRunSessionCommand((draft) => setSyncedBattleState(draft, battleState));

    const ctx = {
      screen: "battle" as const,
      battleSessionRef,
      cardPlayInProgressRef,
      clearAutoEndTurnRef: { current: clearAutoEndTurn },
      getPresentation: () => useBattlePresentationStore.getState(),
    } as unknown as BattleControllerContext;

    const session = {
      clearBattleTimeoutsKeepCompanion: vi.fn(),
      runIfSessionActive: vi.fn((session: number, action: () => void) => {
        if (session === battleSessionRef.current) action();
      }),
    } as unknown as ReturnType<typeof createBattleSession>;

    let releaseDiscard: (() => void) | undefined;
    const discardPromise =
      options?.discardDelay ??
      new Promise<void>((resolve) => {
        releaseDiscard = resolve;
      });

    const transferDeps = {
      animateDiscardedHand: vi.fn(() => discardPromise),
    } as unknown as ReturnType<typeof createBattleTransferDeps>;

    const ui = createBattleEndTurnUi(ctx, session, transferDeps);
    return { ui, battleSessionRef, cardPlayInProgressRef, clearAutoEndTurn, releaseDiscard: releaseDiscard! };
  }

  it("rejects a stale End Turn callback while inspection is open", () => {
    const { ui, cardPlayInProgressRef, clearAutoEndTurn } = makeUi();
    useUiStore.getState().setCardInspection("discard");
    ui.handleEndTurn();
    expect(cardPlayInProgressRef.current).toBe(false);
    expect(clearAutoEndTurn).not.toHaveBeenCalled();
    expect(resolveEndTurnMock).not.toHaveBeenCalled();
  });

  it("sets in-flight flag and clears auto-end on entry, blocking re-entry until resolve finishes", async () => {
    const { ui, cardPlayInProgressRef, clearAutoEndTurn, releaseDiscard } = makeUi();

    ui.handleEndTurn();
    expect(clearAutoEndTurn).toHaveBeenCalledOnce();
    expect(cardPlayInProgressRef.current).toBe(true);

    ui.handleEndTurn();
    expect(resolveEndTurnMock).not.toHaveBeenCalled();

    releaseDiscard();
    await vi.waitFor(() => {
      expect(resolveEndTurnMock).toHaveBeenCalledOnce();
    });
    expect(cardPlayInProgressRef.current).toBe(false);
  });

  it("does not recreate cleared marks when an old discard finishes", async () => {
    const { ui, battleSessionRef, releaseDiscard } = makeUi();
    ui.handleEndTurn();
    battleSessionRef.current += 1;
    clearBattleStageMarks();
    releaseDiscard();
    await Promise.resolve();
    expect(performance.getEntriesByName(battleStageMarkName("discard-end"), "mark")).toHaveLength(0);
    expect(resolveEndTurnMock).not.toHaveBeenCalled();
  });

  it("does not start end turn while a card transfer is in progress", () => {
    useBattlePresentationStore.setState({ cardTransferInProgress: true });
    const { ui, cardPlayInProgressRef, clearAutoEndTurn } = makeUi();

    ui.handleEndTurn();

    expect(clearAutoEndTurn).not.toHaveBeenCalled();
    expect(cardPlayInProgressRef.current).toBe(false);
    expect(resolveEndTurnMock).not.toHaveBeenCalled();
  });
});
