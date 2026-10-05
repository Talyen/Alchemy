import { PlaybackLifetime } from "@/features/alchemy/run-loop/battle/playback-lifetime";
import "../../../../helpers/mock-audio";
import { playBattleEvent, playCardSound } from "@/lib/audio";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBattleEndTurnUi } from "@/features/alchemy/run-loop/battle/end-turn-ui";
import type { BattleControllerContext } from "@/features/alchemy/run-loop/battle/battle-context";
import type { createBattleSession } from "@/features/alchemy/run-loop/battle/battle-session";
import type { createBattleTransferDeps } from "@/features/alchemy/run-loop/battle/battle-transfers";
import { readGameplayState } from "@/features/alchemy/shared/stores/gameplay-state-store";
import { acceptCommand, dispatchGameplayCommand } from "@/features/alchemy/shared/stores/gameplay-command";
import { initializeActiveBattle } from "@/features/alchemy/shared/stores/write/run-battle";
import { useBattlePresentationStore } from "@/features/alchemy/run-loop/battle/battle-presentation-store";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import { patchBattleState, slashDeck } from "../../../../fixtures/battle";
import { resetBattlePresentationAndRun } from "./battle-test-reset";
import { makeDrawSequenceDeps } from "./turn-orchestration-fixture";

vi.mock("@/lib/animation/animation-prefs", () => ({ isAnimationDisabled: () => false }));

beforeEach(() => {
  vi.clearAllMocks();
  resetBattlePresentationAndRun();
  useUiStore.getState().setCardInspection(null);
});

function makeUi(rejectDraw = false, onDraw?: (ctx: BattleControllerContext) => void) {
  const initial = patchBattleState({
    playerHealth: 1000,
    playerMaxHealth: 1000,
    enemyHealth: 1000,
    enemyMaxHealth: 1000,
    hand: slashDeck(3),
    deck: slashDeck(8),
  });
  dispatchGameplayCommand((draft) => acceptCommand(initializeActiveBattle(draft, initial)));
  let releaseDiscard!: () => void;
  const discard = new Promise<void>((resolve) => {
    releaseDiscard = resolve;
  });
  const ctx = {
    screen: "battle",
    playback: new PlaybackLifetime(),
    getPresentation: () => useBattlePresentationStore.getState(),
  } as unknown as BattleControllerContext;
  const active = (id: number) => id === ctx.playback.id;
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
    setTransferInProgress: (active) => ctx.getPresentation().setCardTransferInProgress(active),
    setHiddenHandCardKeys: (update) => ctx.getPresentation().setHiddenHandCardKeys(update),
    playback: {
      beginDraw: (id) => ctx.playback.beginDraw(id),
      get pendingDraws() {
        return ctx.playback.pendingDraws;
      },
      waitForFrame: async () => true,
    },
    animateDrawnHand: async () => {
      if (rejectDraw) throw new Error("draw failed");
      onDraw?.(ctx);
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
    expect(resolved.battle).not.toHaveProperty("pendingBattleTransition");
    expect(resolved.revision).toBe(before.revision + 1);
    expect(ctx.playback.cardPlayInProgress).toBe(true);
    expect(useBattlePresentationStore.getState().displayedBattle).toBe(before.battle.battleState);
    ui.handleEndTurn();
    expect(readGameplayState()).toBe(resolved);
    expect(vi.mocked(playBattleEvent).mock.calls.filter(([event]) => event === "endTurn")).toHaveLength(1);
  });

  it("keeps a focal enemy ability cue on the terminal playback shortcut", () => {
    const { ui } = makeUi();
    vi.mocked(playCardSound).mockReturnValue("slash.ogg");
    dispatchGameplayCommand((draft) =>
      acceptCommand(
        initializeActiveBattle(
          draft,
          patchBattleState({
            playerHealth: 1,
            deathsDoorUsed: true,
            gearEffects: { dodgeChance: -100 },
            currentEnemy: { abilityIds: ["slash"] },
            enemyHealth: 1000,
            enemyMaxHealth: 1000,
          }),
        ),
      ),
    );
    ui.handleEndTurn();
    expect(readGameplayState().battle.battleState.playerHealth).toBe(0);
    expect(playCardSound).toHaveBeenCalledExactlyOnceWith("slash");
    expect(vi.mocked(playBattleEvent).mock.calls.some(([event]) => event === "playerHit")).toBe(false);
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
        expect(ctx.playback.cardPlayInProgress).toBe(false);
        expect(useBattlePresentationStore.getState().displayedBattle).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it("leaves an overlapping card draw visible and blocked when turn playback finishes", async () => {
    vi.useFakeTimers();
    try {
      let finishCardDraw = () => {};
      const { ui, ctx, releaseDiscard } = makeUi(false, (context) => {
        finishCardDraw = context.playback.beginDraw(context.playback.id, "card");
        context.getPresentation().setHiddenHandCardKeys(() => ["drawing-card"]);
      });
      ui.handleEndTurn();
      releaseDiscard();
      await vi.runAllTimersAsync();
      expect(ctx.playback.pendingCardDraws).toBe(1);
      expect(useBattlePresentationStore.getState().hiddenHandCardKeys).toEqual(["drawing-card"]);
      expect(useBattlePresentationStore.getState().cardTransferInProgress).toBe(true);
      finishCardDraw();
    } finally {
      vi.useRealTimers();
    }
  });

  it("cancelling presentation on another screen leaves a playable result", async () => {
    const { ui, ctx, releaseDiscard } = makeUi();
    ui.handleEndTurn();
    const resolved = readGameplayState();
    ctx.screen = "collection";
    releaseDiscard();
    await vi.waitFor(() => expect(ctx.playback.cardPlayInProgress).toBe(false));
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
