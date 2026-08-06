// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createBattleEndTurnUi } from "@/features/alchemy/run-loop/battle/end-turn-ui";
import type { BattleControllerContext } from "@/features/alchemy/run-loop/battle/battle-context";
import type { createBattleSession } from "@/features/alchemy/run-loop/battle/battle-session";
import type { createBattleTransferDeps } from "@/features/alchemy/run-loop/battle/battle-transfer-deps";
import { makeTestBattleState } from "../../../../fixtures/battle";
import { getBattleStoreView, resetRunBattleSlice } from "../../../../helpers/run-domain-store-test";
import { useBattlePresentationStore } from "@/features/alchemy/run-loop/battle/battle-presentation-store";

const { resolveEndTurnMock } = vi.hoisted(() => ({
  resolveEndTurnMock: vi.fn(() => false),
}));

vi.mock("@/features/alchemy/run-loop/battle/turn-orchestration", () => ({
  resolveEndTurn: resolveEndTurnMock,
  createTurnOrchestration: () => ({
    logBattleError: vi.fn(),
    resetHandTransferUi: vi.fn(),
  }),
  resumePendingBattleTransition: vi.fn(),
}));

vi.mock("@/lib/animation/animation-prefs", () => ({
  isAnimationDisabled: () => false,
}));

describe("createBattleEndTurnUi handleEndTurn", () => {
  beforeEach(() => {
    resetRunBattleSlice();
    useBattlePresentationStore.setState(useBattlePresentationStore.getInitialState());
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
    getBattleStoreView().setSyncedBattleState(battleState);

    const ctx = {
      screen: "battle" as const,
      battleSessionRef,
      cardPlayInProgressRef,
      clearAutoEndTurnRef: { current: clearAutoEndTurn },
    } as unknown as BattleControllerContext;

    const session = {
      clearBattleTimeoutsKeepCompanion: vi.fn(),
      runIfSessionActive: vi.fn((_session: number, action: () => void) => action()),
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
    return { ui, cardPlayInProgressRef, clearAutoEndTurn, releaseDiscard: releaseDiscard! };
  }

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
});
