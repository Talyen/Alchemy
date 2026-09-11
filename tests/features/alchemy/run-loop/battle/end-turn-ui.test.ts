import "../../../../helpers/mock-audio";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBattleEndTurnUi } from "@/features/alchemy/run-loop/battle/end-turn-ui";
import type { BattleControllerContext } from "@/features/alchemy/run-loop/battle/battle-context";
import type { createBattleSession } from "@/features/alchemy/run-loop/battle/battle-session";
import type { createBattleTransferDeps } from "@/features/alchemy/run-loop/battle/battle-transfer-deps";
import { readGameplayState } from "@/features/alchemy/shared/stores/gameplay-state-store";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { initializeActiveBattle } from "@/features/alchemy/shared/stores/run-session-write-port";
import { useBattlePresentationStore } from "@/features/alchemy/run-loop/battle/battle-presentation-store";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import { patchBattleState, slashDeck } from "../../../../fixtures/battle";
import { resetBattlePresentationAndRun } from "./battle-test-reset";
import { makeDrawSequenceDeps } from "./turn-orchestration-fixture";

vi.mock("@/lib/animation/animation-prefs", () => ({ isAnimationDisabled: () => false }));

beforeEach(() => {
  resetBattlePresentationAndRun();
  useUiStore.getState().setCardInspection(null);
});

function makeUi(rejectDraw = false) {
  const initial = patchBattleState({
    playerHealth: 1000,
    playerMaxHealth: 1000,
    enemyHealth: 1000,
    enemyMaxHealth: 1000,
    hand: slashDeck(3),
    deck: slashDeck(8),
  });
  dispatchRunSessionCommand((draft) => initializeActiveBattle(draft, initial));
  let releaseDiscard!: () => void;
  const discard = new Promise<void>((resolve) => {
    releaseDiscard = resolve;
  });
  const ctx = {
    screen: "battle",
    battleSessionRef: { current: 1 },
    cardPlayInProgressRef: { current: false },
    clearAutoEndTurnRef: { current: vi.fn() },
    scheduleAutoEndTurnRef: { current: vi.fn() },
    getPresentation: () => useBattlePresentationStore.getState(),
  } as unknown as BattleControllerContext;
  const active = (id: number) => id === ctx.battleSessionRef.current;
  const session = {
    isCurrentBattleSession: active,
    runIfSessionActive: (id: number, action: () => unknown) => {
      if (active(id)) return action();
      return undefined;
    },
    checkBattleEnd: vi.fn(() => false),
    clearAllBattleTimeouts: vi.fn(),
  } as unknown as ReturnType<typeof createBattleSession>;
  const deps = makeDrawSequenceDeps({
    animateDrawnHand: async () => {
      if (rejectDraw) throw new Error("draw failed");
    },
  });
  const transfers = { animateDiscardedHand: () => discard, getDrawSequenceDeps: () => deps } as unknown as ReturnType<
    typeof createBattleTransferDeps
  >;
  return { ui: createBattleEndTurnUi(ctx, session, transfers), ctx, releaseDiscard };
}

describe("End Turn execution and playback", () => {
  it("commits before discard playback and blocks a second End Turn", () => {
    const { ui, ctx } = makeUi();
    const before = readGameplayState();
    ui.handleEndTurn();
    const resolved = readGameplayState();
    expect(resolved.battle.battleState.turn).toBeGreaterThan(before.battle.battleState.turn);
    expect(resolved.battle.pendingBattleTransition).toBeNull();
    expect(resolved.revision).toBe(before.revision + 1);
    expect(ctx.cardPlayInProgressRef.current).toBe(true);
    expect(useBattlePresentationStore.getState().displayedBattle).toBe(before.battle.battleState);
    ui.handleEndTurn();
    expect(readGameplayState()).toBe(resolved);
  });

  it.each([false, true])(
    "playback completion or failure cannot alter the committed turn (failure=%s)",
    async (rejectDraw) => {
      vi.useFakeTimers();
      try {
        const { ui, ctx, releaseDiscard } = makeUi(rejectDraw);
        ui.handleEndTurn();
        const resolved = readGameplayState();
        releaseDiscard();
        await vi.runAllTimersAsync();
        expect(readGameplayState()).toBe(resolved);
        expect(ctx.cardPlayInProgressRef.current).toBe(false);
        expect(useBattlePresentationStore.getState().displayedBattle).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it("cancelling presentation on another screen leaves a playable result", async () => {
    const { ui, ctx, releaseDiscard } = makeUi();
    ui.handleEndTurn();
    const resolved = readGameplayState();
    ctx.screen = "collection";
    releaseDiscard();
    await vi.waitFor(() => expect(ctx.cardPlayInProgressRef.current).toBe(false));
    expect(readGameplayState()).toBe(resolved);
    expect(resolved.battle.battleState.turnPhase).toBe("player");
  });

  it("rejects End Turn while inspecting cards without advancing RNG", () => {
    const { ui } = makeUi();
    useUiStore.getState().setCardInspection("discard");
    const before = readGameplayState();
    ui.handleEndTurn();
    expect(readGameplayState()).toBe(before);
  });
});
