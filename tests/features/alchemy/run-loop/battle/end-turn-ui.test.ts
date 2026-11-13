import { createCleanup } from "@/lib/cleanup";
import "../../../../helpers/mock-audio";
import { selectBattle } from "@/features/alchemy/shared/stores/session/run-reads";
import {
  mutateGameplayForTest,
  initializeBattleForTest as initializeActiveBattle,
} from "../../../../helpers/run-domain-store-test";
import { readBattle } from "@/features/alchemy/shared/stores/session/run-reads";
import { PlaybackLifetime } from "@/features/alchemy/run-loop/battle/playback-lifetime";
import { playBattleEvent, playCardSound } from "@/lib/audio";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBattleEndTurnUi } from "@/features/alchemy/run-loop/battle/end-turn-ui";
import type { BattleControllerContext } from "@/features/alchemy/run-loop/battle/battle-context";
import type { createBattleSession } from "@/features/alchemy/run-loop/battle/battle-session";
import type { createBattleTransferDeps } from "@/features/alchemy/run-loop/battle/battle-transfers";
import { readGameplayState } from "@/features/alchemy/shared/stores/session/gameplay-state-reads";
import { battlePresentation } from "@/app/battle-presentation";
import { useUiStore } from "@/features/alchemy/shared/stores/react/ui-store";
import { patchBattleState, slashDeck } from "../../../../fixtures/battle";
import { resetBattlePresentationAndRun } from "./battle-test-reset";
import { makeDrawSequenceDeps } from "./turn-orchestration-fixture";
import { createBattleCapabilities } from "@/features/alchemy/shared/stores/commands/battle-commands";
import { defaultGameSession } from "@/app/application-session";
import { companionLibrary, type BattleCard } from "@/lib/game-data";
import { CARDS_PER_TURN } from "@/lib/game-constants";
import { getHandCardKey } from "@/features/alchemy/run-loop/battle/playable-hand";
import { setScreen } from "@/features/alchemy/shared/stores/commands/run-session-write-port";

vi.mock("@/lib/animation/animation-prefs", () => ({
  isAnimationDisabled: () => false,
  shouldReduceMotion: () => false,
}));

beforeEach(() => {
  vi.clearAllMocks();
  resetBattlePresentationAndRun();
  useUiStore.getState().setCardInspection(null);
});

function makeUi(
  rejectDraw = false,
  onDraw?: (ctx: BattleControllerContext) => void,
  companionId?: "library-owl" | "wolf",
) {
  const initial = patchBattleState({
    playerHealth: 1000,
    playerMaxHealth: 1000,
    enemyHealth: 1000,
    enemyMaxHealth: 1000,
    hand: slashDeck(3),
    deck: slashDeck(8),
    activeCompanion: companionId ? companionLibrary[companionId] : null,
  });
  mutateGameplayForTest((draft) => {
    initializeActiveBattle(draft, initial);
    setScreen(draft, "battle");
  });
  let releaseDiscard!: () => void;
  const discard = new Promise<void>((resolve) => {
    releaseDiscard = resolve;
  });
  const ctx = {
    battle: createBattleCapabilities(defaultGameSession),
    screen: "battle",
    playback: new PlaybackLifetime(),
    getPresentation: () => battlePresentation.getState(),
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
  const draws: BattleCard[][] = [];
  const deps = makeDrawSequenceDeps({
    setTransferInProgress: (active) => ctx.getPresentation().setCardTransferInProgress(active),
    setHiddenHandCardKeys: (update) => ctx.getPresentation().setHiddenHandCardKeys(update),
    playback: {
      beginDraw: (id) => ctx.playback.beginDraw(id),
      get pendingDraws() {
        return ctx.playback.pendingDraws;
      },
      waitForFrame: async () => true,
      waitForDelay: async (_id: number, ms: number) => {
        await new Promise((resolve) => {
          setTimeout(resolve, ms);
        });
        return true;
      },
    },
    animateDrawnHand: async (cards) => {
      draws.push(cards);
      if (rejectDraw) throw new Error("draw failed");
      onDraw?.(ctx);
    },
  });
  const transfers = { animateDiscardedHand: () => discard, getDrawSequenceDeps: () => deps } as unknown as ReturnType<
    typeof createBattleTransferDeps
  >;
  return { ui: createBattleEndTurnUi(ctx, session, transfers), ctx, releaseDiscard, draws };
}

describe("End Turn execution and playback", () => {
  it("hides each actual Owl draw before publishing its hand, animates it once, and releases successive turns", async () => {
    vi.useFakeTimers();
    using _scopeCleanup = createCleanup(() => vi.useRealTimers());
    const { ui, ctx, releaseDiscard, draws } = makeUi(false, undefined, "library-owl");
    const owlHands: Array<{ hand: BattleCard[]; hidden: readonly string[] }> = [];
    const casts: string[] = [];
    const unsubscribe = battlePresentation.subscribe((state) => {
      if (state.displayedBattle?.hand.length === CARDS_PER_TURN + 1)
        owlHands.push({ hand: state.displayedBattle.hand, hidden: state.hiddenHandCardKeys });
      if (state.companionActionCue) casts.push(state.companionActionCue.kind);
    });
    using _subscription = createCleanup(unsubscribe);
    for (let turn = 0; turn < 2; turn++) {
      ui.handleEndTurn(readBattle(defaultGameSession).battleState);
      const committed = readGameplayState(defaultGameSession);
      releaseDiscard();
      await vi.runAllTimersAsync();
      expect(readGameplayState(defaultGameSession)).toBe(committed);
      expect(ctx.playback.pendingDraws).toBe(0);
      expect(ctx.playback.cardPlayInProgress).toBe(false);
      expect(battlePresentation.getState().hiddenHandCardKeys).toEqual([]);
      expect(battlePresentation.getState().cardTransferInProgress).toBe(false);
      expect(battlePresentation.getState().displayedBattle).toBeNull();
    }
    expect(draws.map((cards) => cards.length)).toEqual([CARDS_PER_TURN, 1, CARDS_PER_TURN, 1]);
    expect(draws[1]?.[0]?.uid).not.toBe(draws[3]?.[0]?.uid);
    for (const cards of [draws[1]!, draws[3]!]) {
      const card = cards[0]!;
      const firstPublication = owlHands.find(({ hand }) => hand.at(-1)?.uid === card.uid)!;
      expect(firstPublication).toBeDefined();
      expect(firstPublication.hidden).toContain(getHandCardKey(card, CARDS_PER_TURN));
    }
    expect(casts).toContain("cast");
    expect(battlePresentation.getState().companionActionCue).toBeNull();
  });

  it.each(["library-owl", "wolf"] as const)("presents %s using its actual action type", async (companionId) => {
    vi.useFakeTimers();
    using _scopeCleanup = createCleanup(() => vi.useRealTimers());
    const { ui, releaseDiscard } = makeUi(false, undefined, companionId);
    const before = battlePresentation.getState();
    ui.handleEndTurn(readBattle(defaultGameSession).battleState);
    const committed = readGameplayState(defaultGameSession);
    releaseDiscard();
    await vi.runAllTimersAsync();
    const after = battlePresentation.getState();
    expect(after.playerAttackToken).toBe(before.playerAttackToken);
    expect(after.playerCastToken).toBe(before.playerCastToken);
    // All queued action animations have completed; no stale cue survives.
    expect(after.companionActionCue).toBeNull();
    expect(readGameplayState(defaultGameSession)).toBe(committed);
  });

  it("cannot clear a replacement hand or draw lease when an Owl transfer is cancelled", async () => {
    vi.useFakeTimers();
    using _scopeCleanup = createCleanup(() => vi.useRealTimers());
    let count = 0;
    let finishReplacement = () => {};
    const { ui, ctx, releaseDiscard } = makeUi(
      false,
      (context) => {
        if (++count !== 2) return;
        context.playback.restart();
        context.getPresentation().resetPresentation();
        finishReplacement = context.playback.beginDraw(context.playback.id);
        context.getPresentation().setHiddenHandCardKeys(() => ["replacement-card"]);
        context.getPresentation().setCardTransferInProgress(true);
      },
      "library-owl",
    );
    ui.handleEndTurn(readBattle(defaultGameSession).battleState);
    const committed = readGameplayState(defaultGameSession);
    releaseDiscard();
    await vi.runAllTimersAsync();
    expect(count).toBe(2);
    expect(readGameplayState(defaultGameSession)).toBe(committed);
    expect(ctx.playback.pendingDraws).toBe(1);
    expect(battlePresentation.getState().hiddenHandCardKeys).toEqual(["replacement-card"]);
    expect(battlePresentation.getState().cardTransferInProgress).toBe(true);
    finishReplacement();
  });

  it("commits before discard playback and blocks a second End Turn", () => {
    const { ui, ctx } = makeUi();
    const before = readGameplayState(defaultGameSession);
    ui.handleEndTurn(readBattle(defaultGameSession).battleState);
    const resolved = readGameplayState(defaultGameSession);
    expect(selectBattle(resolved).battleState.turn).toBeGreaterThan(selectBattle(before).battleState.turn);
    expect(selectBattle(resolved)).not.toHaveProperty("pendingBattleTransition");
    expect(resolved.revision).toBe(before.revision + 1);
    expect(ctx.playback.cardPlayInProgress).toBe(true);
    expect(battlePresentation.getState().displayedBattle).toEqual(selectBattle(before).battleState);
    ui.handleEndTurn(readBattle(defaultGameSession).battleState);
    expect(readGameplayState(defaultGameSession)).toBe(resolved);
    expect(vi.mocked(playBattleEvent).mock.calls.filter(([event]) => event === "endTurn")).toHaveLength(1);
  });

  it("keeps a focal enemy ability cue on the terminal playback shortcut", () => {
    const { ui } = makeUi();
    vi.mocked(playCardSound).mockReturnValue("slash.ogg");
    mutateGameplayForTest((draft) =>
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
    );
    ui.handleEndTurn(readBattle(defaultGameSession).battleState);
    expect(readBattle(defaultGameSession).battleState.playerHealth).toBe(0);
    expect(playCardSound).toHaveBeenCalledExactlyOnceWith("slash");
    expect(vi.mocked(playBattleEvent).mock.calls.some(([event]) => event === "playerHit")).toBe(false);
  });

  it.each([false, true])(
    "playback completion or failure cannot alter the committed turn (failure=%s)",
    async (rejectDraw) => {
      vi.useFakeTimers();
      using _scopeCleanup = createCleanup(() => vi.useRealTimers());

      const { ui, ctx, releaseDiscard } = makeUi(rejectDraw);
      ui.handleEndTurn(readBattle(defaultGameSession).battleState);
      const resolved = readGameplayState(defaultGameSession);
      releaseDiscard();
      await vi.runAllTimersAsync();
      expect(readGameplayState(defaultGameSession)).toBe(resolved);
      expect(ctx.playback.cardPlayInProgress).toBe(false);
      expect(battlePresentation.getState().displayedBattle).toBeNull();
    },
  );

  it("leaves an overlapping card draw visible and blocked when turn playback finishes", async () => {
    vi.useFakeTimers();
    using _scopeCleanup = createCleanup(() => vi.useRealTimers());

    let finishCardDraw = () => {};
    const { ui, ctx, releaseDiscard } = makeUi(false, (context) => {
      finishCardDraw = context.playback.beginDraw(context.playback.id, "card");
      context.getPresentation().setHiddenHandCardKeys(() => ["drawing-card"]);
    });
    ui.handleEndTurn(readBattle(defaultGameSession).battleState);
    releaseDiscard();
    await vi.runAllTimersAsync();
    expect(ctx.playback.pendingCardDraws).toBe(1);
    expect(battlePresentation.getState().hiddenHandCardKeys).toEqual(["drawing-card"]);
    expect(battlePresentation.getState().cardTransferInProgress).toBe(true);
    finishCardDraw();
  });

  it("cancelling presentation on another screen leaves a playable result", async () => {
    const { ui, ctx, releaseDiscard } = makeUi();
    ui.handleEndTurn(readBattle(defaultGameSession).battleState);
    const resolved = readGameplayState(defaultGameSession);
    ctx.screen = "collection";
    releaseDiscard();
    await vi.waitFor(() => expect(ctx.playback.cardPlayInProgress).toBe(false));
    expect(readGameplayState(defaultGameSession)).toBe(resolved);
    expect(selectBattle(resolved).battleState.turnPhase).toBe("player");
  });

  it("rejects a stale confirmation snapshot before committing or starting playback", () => {
    const { ui, ctx } = makeUi();
    const expected = readBattle(defaultGameSession).battleState;
    mutateGameplayForTest((draft) => initializeActiveBattle(draft, { ...expected, mana: 0 }));
    const before = readGameplayState(defaultGameSession);
    ui.handleEndTurn(expected);
    expect(readGameplayState(defaultGameSession)).toBe(before);
    expect(ctx.playback.cardPlayInProgress).toBe(false);
    expect(playBattleEvent).not.toHaveBeenCalled();
  });

  it("rejects End Turn while inspecting cards without advancing RNG", () => {
    const { ui } = makeUi();
    useUiStore.getState().setCardInspection("discard");
    const before = readGameplayState(defaultGameSession);
    ui.handleEndTurn(readBattle(defaultGameSession).battleState);
    expect(readGameplayState(defaultGameSession)).toBe(before);
  });
});
