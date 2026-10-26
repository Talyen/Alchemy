import { createCleanup } from "@/lib/cleanup";
import "../../../../helpers/mock-audio";
import {
  mutateGameplayForTest,
  setBattleActiveForTest,
  replaceBattleForTest as setSyncedBattleState,
} from "../../../../helpers/run-domain-store-test";
import { PlaybackLifetime } from "@/features/alchemy/run-loop/battle/playback-lifetime";
import { act, renderHook } from "@testing-library/react";
import { useBattleScreenRouteData } from "@/app/screen-routes/use-battle-screen-route-data";
import { useBattleAutoplay } from "@/features/alchemy/run-loop/battle/use-battle-autoplay";
import { battleSnapshot, type BattleSnapshot } from "@/lib/battle";
import { useUiStore } from "@/features/alchemy/shared/stores/react/ui-store";
import { describe, expect, it, vi, beforeEach, afterEach, type Mock } from "vitest";
import { useRef, type MouseEvent } from "react";
import { createBattleCardPlay } from "@/features/alchemy/run-loop/battle/battle-card-play";
import type { BattleControllerContext } from "@/features/alchemy/run-loop/battle/battle-context";
import { createBattleSession } from "@/features/alchemy/run-loop/battle/battle-session";
import type { createBattleTransferDeps } from "@/features/alchemy/run-loop/battle/battle-transfers";
import { setScreen } from "@/features/alchemy/shared/stores/commands/run-session-write-port";
import { readBattle } from "@/features/alchemy/shared/stores/session/run-reads";
import { resetBattlePresentationAndRun } from "./battle-test-reset";
import { makeTestBattleState } from "../../../../fixtures/battle";
import { makeTestCard } from "../../../../fixtures/battle";
import { playBattleEvent, playCardSound, playUISound } from "@/lib/audio";
import { getHandCardKey } from "@/features/alchemy/run-loop/battle/playable-hand";
import { AUTO_END_TURN_DELAY_MS, AUTOPLAY_PREVIEW_MS } from "@/lib/game-constants";
import { useBattleAutoEndTurn } from "@/features/alchemy/run-loop/battle/use-battle-auto-end-turn";
import { logError } from "@/lib/error-logger";
import { battlePresentation } from "@/app/battle-presentation";
import { makeDrawSequenceDeps } from "./turn-orchestration-fixture";
import { isBattlePlaybackBlocked } from "@/features/alchemy/run-loop/battle/playback-gate";
import {
  readCardAnimationInProgress,
  readPlaybackPresentationGate,
} from "@/features/alchemy/run-loop/battle/presentation/use-hand-presentation";
import { isBattleInspectionBlocked } from "@/app/use-card-inspection";
import { createBattleEndTurnUi } from "@/features/alchemy/run-loop/battle/end-turn-ui";

vi.mock("@/lib/error-logger", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/error-logger")>()),
  logError: vi.fn(),
}));

vi.mock("@/features/alchemy/run-loop/battle/card-transfer-animations", () => ({
  animateCardActivation: vi.fn(),
}));

vi.mock("@/features/alchemy/run-loop/battle/draw-sequence", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/alchemy/run-loop/battle/draw-sequence")>();
  return {
    ...actual,
    runHandDrawSequence: vi.fn(async (_oldHand, _newState, onReveal) => {
      onReveal();
      return false;
    }),
    runBattleDraw: vi.fn(async (request) => {
      request.onReveal();
      request.onSettled?.();
      return false;
    }),
  };
});

vi.mock("@/features/alchemy/shared/stores/commands/run-session-write-port", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/alchemy/shared/stores/commands/run-session-write-port")>()),
  awardCardXP: vi.fn(),
}));

// Autoplay previews are timing-sensitive; default to reduced motion so existing
// tests keep their synchronous shape. Preview tests opt back into motion below.
vi.mock("@/lib/animation/animation-prefs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/animation/animation-prefs")>()),
  shouldReduceMotion: vi.fn(() => true),
}));
import { shouldReduceMotion } from "@/lib/animation/animation-prefs";
import { awardCardXP } from "@/features/alchemy/shared/stores/commands/run-session-write-port";
import { createBattleCapabilities } from "@/features/alchemy/shared/stores/commands/battle-commands";
import { defaultGameSession } from "@/app/application-session";

function slashCard() {
  return makeTestCard({ id: "slash", cost: 1, effects: [{ kind: "damage", damageType: "physical", amount: 6 }] });
}

const autoplayControl = { signal: new AbortController().signal, canCommit: () => true };

function givenBattle(state: BattleSnapshot): void {
  mutateGameplayForTest((draft) => {
    setSyncedBattleState(draft, state);
    setBattleActiveForTest(draft, true);
    setScreen(draft, "battle");
  });
}

function makeDeps(overrides: Partial<BattleControllerContext> = {}) {
  const playback = new PlaybackLifetime();
  playback.restart();
  vi.spyOn(playback, "scheduleAutoEndTurn");
  const ctx: BattleControllerContext = {
    screen: "battle" as const,
    battle: createBattleCapabilities(defaultGameSession),
    playback,
    endTurnButtonRef: { current: null },
    handCardRefs: { current: {} },
    drawPileRef: { current: null },
    discardPileRef: { current: null },
    playerPanelRef: { current: null },
    enemyPanelRef: { current: null },
    battleSceneRef: { current: null },
    setHoveredCardId: vi.fn(),
    measureElementRect: () => null,
    measureVisualCardRect: () => null,
    presentation: battlePresentation,
    getPresentation: battlePresentation.getState,
    ...overrides,
  };

  const session = {
    runIfSessionActive: vi.fn((_session, action) => action()),
    checkBattleEnd: vi.fn(),
  } as unknown as ReturnType<typeof createBattleSession>;

  const transferDeps = {
    getDrawSequenceDeps: vi.fn(() => ({
      isSessionActive: () => true,
      animateDrawnHand: vi.fn(),
      setTransferInProgress: vi.fn(),
      setHiddenHandCardKeys: vi.fn(),
    })),
  } as unknown as ReturnType<typeof createBattleTransferDeps>;

  return {
    ctx,
    session,
    transferDeps,
    ...createBattleCardPlay(ctx, session, transferDeps),
    awardCardXP: vi.mocked(awardCardXP),
  };
}

function expectAwardedCard(awardCardXP: Mock, cardId: string) {
  expect(awardCardXP).toHaveBeenCalled();
  expect(awardCardXP.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ id: cardId }));
}

function clickCard(
  handleCardClick: ReturnType<typeof createBattleCardPlay>["handleCardClick"],
  card: ReturnType<typeof makeTestCard> & { uid: number },
  index: number,
  expected = readBattle(defaultGameSession).battleState,
) {
  const button = document.createElement("button");
  Object.defineProperty(button, "getBoundingClientRect", {
    value: () => new DOMRect(0, 0, 10, 10),
  });
  handleCardClick(card, index, { currentTarget: button } as unknown as MouseEvent<HTMLButtonElement>, expected);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(playCardSound).mockImplementation((id) => `${id}.ogg`);
  resetBattlePresentationAndRun();
  useUiStore.getState().setCardInspection(null);
});

afterEach(() => {
  vi.useRealTimers();
  vi.mocked(shouldReduceMotion).mockReturnValue(true);
});

describe("createBattleCardPlay", () => {
  it("cannot auto-end a replacement battle before React receives its new hand", () => {
    vi.useFakeTimers();
    givenBattle(makeTestBattleState({ hand: [], mana: 0 }));
    const { ctx, transferDeps } = makeDeps();
    const ui = createBattleEndTurnUi(ctx, createBattleSession(ctx), transferDeps);
    const offered = readBattle(defaultGameSession).battleState;
    const { unmount } = renderHook(() => {
      const presentationGateRef = useRef(readPlaybackPresentationGate(battlePresentation));
      const scheduleAutoEndTurnRef = useRef<(state?: BattleSnapshot) => void>(() => {});
      return useBattleAutoEndTurn({
        autoEndTurn: true,
        screen: "battle",
        hasActiveBattle: true,
        battleState: offered,
        onEndTurn: ui.handleEndTurn,
        presentationGateRef,
        scheduleAutoEndTurnRef,
      });
    });
    using _scopeCleanup = createCleanup(() => unmount());

    givenBattle(makeTestBattleState({ hand: [{ ...slashCard(), uid: 7 }], mana: 3 }));
    const replacement = readBattle(defaultGameSession).battleState;
    act(() => vi.advanceTimersByTime(AUTO_END_TURN_DELAY_MS));
    expect(readBattle(defaultGameSession).battleState).toBe(replacement);
    expect(playBattleEvent).not.toHaveBeenCalled();
  });

  it("keeps a current route offer playable while showing a copied playback frame", () => {
    const card = { ...slashCard(), uid: 7 };
    givenBattle(makeTestBattleState({ hand: [card], mana: 3, enemyHealth: 30 }));
    battlePresentation.getState().setDisplayedBattle(readBattle(defaultGameSession).battleState);
    const { result, unmount } = renderHook(() => useBattleScreenRouteData(battlePresentation));
    using _scopeCleanup = createCleanup(() => unmount());

    const { battleScreenData, inputBattleState } = result.current;
    expect(battleScreenData.battleState).not.toBe(inputBattleState);
    const { handleCardClick } = makeDeps();
    act(() => clickCard(handleCardClick, { ...battleScreenData.battleState.hand[0]!, uid: 7 }, 0, inputBattleState));
    expect(readBattle(defaultGameSession).battleState.hand).toHaveLength(0);
    expect(playCardSound).toHaveBeenCalledExactlyOnceWith("slash");
  });

  it.each(["manual", "autoplay"] as const)(
    "rejects a %s card offered by a replaced battle even when the card UID repeats",
    async (mode) => {
      const card = { ...slashCard(), uid: 7 };
      givenBattle(makeTestBattleState({ hand: [card], mana: 3, enemyHealth: 30 }));
      const expected = readBattle(defaultGameSession).battleState;
      const { handleCardClick, handleAutoplayCard, awardCardXP } = makeDeps();
      givenBattle(makeTestBattleState({ hand: [card], mana: 3, enemyHealth: 30 }));
      const replacement = readBattle(defaultGameSession).battleState;
      useUiStore.getState().setAutoplayPreviewCardId("hand-slash-7");

      if (mode === "manual") clickCard(handleCardClick, card, 0, expected);
      else await expect(handleAutoplayCard(card, 0, autoplayControl, expected)).resolves.toBe(false);

      expect(readBattle(defaultGameSession).battleState).toBe(replacement);
      expect(awardCardXP).not.toHaveBeenCalled();
      expect(playCardSound).not.toHaveBeenCalled();
      expect(useUiStore.getState().autoplayPreviewCardId).toBe("hand-slash-7");
    },
  );

  it.each(["manual", "autoplay"] as const)(
    "rejects a %s Wish offered by the previous queue even when its card ID repeats",
    async (mode) => {
      const card = makeTestCard({ id: "slash" });
      givenBattle(makeTestBattleState({ wishOptions: [card], wishQueue: [[card]] }));
      const expected = readBattle(defaultGameSession).battleState;
      const { handleWishChoice, handleAutoplayWish } = makeDeps();
      handleWishChoice(card, expected);
      const nextWish = readBattle(defaultGameSession).battleState;
      vi.mocked(playUISound).mockClear();

      if (mode === "manual") handleWishChoice(card, expected);
      else await expect(handleAutoplayWish(card, autoplayControl, expected)).resolves.toBe(false);

      expect(readBattle(defaultGameSession).battleState).toBe(nextWish);
      expect(nextWish.hand).toHaveLength(1);
      expect(nextWish.wishOptions).toEqual([card]);
      expect(playUISound).not.toHaveBeenCalled();
    },
  );

  it("a rejected stale click preserves the snapshot currently being presented", () => {
    const card = { ...makeTestCard({ cost: 1 }), uid: 1 };
    const state = makeTestBattleState({ hand: [card], mana: 0 });
    givenBattle(state);
    const shown = battleSnapshot({ ...state, mana: 2 });
    battlePresentation.getState().setDisplayedBattle(shown);
    const published = battlePresentation.getState().displayedBattle;
    const { handleCardClick } = makeDeps();
    clickCard(handleCardClick, card, 0);
    expect(battlePresentation.getState().displayedBattle).toBe(published);
    expect(readBattle(defaultGameSession).battleState.mana).toBe(0);
    expect(battlePresentation.getState().cardRejection).toEqual({ cardKey: getHandCardKey(card, 0), mana: true });
    clickCard(handleCardClick, card, 0);
    expect(playUISound).toHaveBeenCalledExactlyOnceWith("error");
    expect(battlePresentation.getState().playerAttackToken).toBe(0);
  });

  it("a stale autoplay preview cannot choose the same catalog card from the next queued Wish", async () => {
    vi.useFakeTimers();
    vi.mocked(shouldReduceMotion).mockReturnValue(false);

    const first = makeTestCard({ id: "slash" });
    const state = makeTestBattleState({ wishOptions: [first], wishQueue: [[first]] });
    givenBattle(state);
    const { handleAutoplayWish, handleWishChoice } = makeDeps();
    const offered = readBattle(defaultGameSession).battleState.wishOptions![0]!;
    const pending = handleAutoplayWish(offered, autoplayControl, readBattle(defaultGameSession).battleState);
    handleWishChoice(offered, readBattle(defaultGameSession).battleState);
    await vi.advanceTimersByTimeAsync(AUTOPLAY_PREVIEW_MS);
    await expect(pending).resolves.toBe(false);
    expect(readBattle(defaultGameSession).battleState.hand).toHaveLength(1);
    expect(readBattle(defaultGameSession).battleState.wishOptions).toEqual([first]);
  });
  it.each([{ burn: 0 }, { burn: 3 }])(
    "acknowledges accepted Cleanse even without a removable status (Burn $burn)",
    ({ burn }) => {
      const cleanse = makeTestCard({
        id: "cleanse",
        cost: 1,
        effects: [
          { kind: "remove-harmful-status", amount: 1 },
          { kind: "heal", amount: 2 },
        ],
      });
      const base = makeTestBattleState();
      const state = makeTestBattleState({
        hand: [{ ...cleanse, uid: 1 }],
        mana: 3,
        playerHealth: 20,
        playerStatuses: { ...base.playerStatuses, burn },
      });
      givenBattle(state);

      const { handleCardClick } = makeDeps();
      clickCard(handleCardClick, { ...cleanse, uid: 1 }, 0);

      expect(playCardSound).toHaveBeenCalledExactlyOnceWith("cleanse");
    },
  );

  it.each(["manual", "autoplay"] as const)("plays a legal card through %s and syncs battle state", async (mode) => {
    const slash = slashCard();
    const state = makeTestBattleState({
      hand: [{ ...slash, uid: 1 }],
      mana: 3,
      enemyHealth: 30,
    });
    givenBattle(state);

    const { ctx, awardCardXP, handleCardClick, handleAutoplayCard } = makeDeps();
    if (mode === "manual") clickCard(handleCardClick, { ...slash, uid: 1 }, 0);
    else
      await expect(
        handleAutoplayCard({ ...slash, uid: 1 }, 0, autoplayControl, readBattle(defaultGameSession).battleState),
      ).resolves.toBe(true);

    expect(readBattle(defaultGameSession).battleState.hand.length).toBe(0);
    expect(readBattle(defaultGameSession).battleState.enemyHealth).toBeLessThan(30);
    await vi.waitFor(() => {
      expect(ctx.playback.scheduleAutoEndTurn).toHaveBeenCalled();
    });
    expectAwardedCard(awardCardXP, "slash");
    expect(playCardSound).toHaveBeenCalledExactlyOnceWith("slash");
    expect(playBattleEvent).not.toHaveBeenCalled();
    expect(playUISound).not.toHaveBeenCalled();
    expect(logError).not.toHaveBeenCalled();
    expect(battlePresentation.getState().playerAttackToken).toBe(1);
  });

  it("rejects stale manual and autoplay callbacks while inspecting", async () => {
    const slash = { ...makeTestCard({ id: "slash", cost: 1 }), uid: 1 };
    const state = makeTestBattleState({ hand: [slash], mana: 3, enemyHealth: 30 });
    givenBattle(state);
    const { awardCardXP, handleCardClick, handleAutoplayCard } = makeDeps();
    useUiStore.getState().setCardInspection("deck");
    clickCard(handleCardClick, slash, 0);
    await expect(
      handleAutoplayCard(slash, 0, autoplayControl, readBattle(defaultGameSession).battleState),
    ).resolves.toBe(false);
    expect(readBattle(defaultGameSession).battleState).toEqual(battleSnapshot(state));
    expect(awardCardXP).not.toHaveBeenCalled();
  });

  it("accepts rapid plays by identity and waits for all draws before settling the latest state", async () => {
    vi.mocked(shouldReduceMotion).mockReturnValue(false);
    const { runBattleDraw } = await import("@/features/alchemy/run-loop/battle/draw-sequence");
    const settled: Array<() => void> = [];
    vi.mocked(runBattleDraw)
      .mockImplementationOnce(async (request) => {
        request.onReveal();
        settled.push(request.onSettled!);
        return true;
      })
      .mockImplementationOnce(async (request) => {
        request.onReveal();
        settled.push(request.onSettled!);
        return true;
      });
    const first = makeTestCard({ id: "slash", uid: 11, cost: 1 });
    const second = makeTestCard({ id: "slash", uid: 12, cost: 1 });
    givenBattle(
      makeTestBattleState({
        hand: [first, second],
        mana: 3,
        enemyHealth: 100,
      }),
    );
    const { ctx, session, handleAutoplayCard } = makeDeps();
    await expect(
      handleAutoplayCard(first, 0, autoplayControl, readBattle(defaultGameSession).battleState),
    ).resolves.toBe(true);
    await expect(
      handleAutoplayCard(second, 1, autoplayControl, readBattle(defaultGameSession).battleState),
    ).resolves.toBe(true);
    expect(readBattle(defaultGameSession).battleState.mana).toBe(1);
    expect(readBattle(defaultGameSession).battleState.hand).toHaveLength(0);
    await expect(
      handleAutoplayCard(first, 0, autoplayControl, readBattle(defaultGameSession).battleState),
    ).resolves.toBe(false);
    settled[1]!();
    expect(ctx.playback.cardPlayInProgress).toBe(true);
    expect(session.checkBattleEnd).toHaveBeenCalledTimes(2);
    settled[0]!();
    expect(ctx.playback.cardPlayInProgress).toBe(false);
    expect(session.checkBattleEnd).toHaveBeenCalledWith(readBattle(defaultGameSession).battleState, 1);
    expect(ctx.playback.scheduleAutoEndTurn).toHaveBeenCalledWith(readBattle(defaultGameSession).battleState);
    expect(playUISound).not.toHaveBeenCalled();
  });

  it("keeps the hand closed once End Turn has started", async () => {
    const card = { ...makeTestCard({ id: "slash", cost: 0 }), uid: 1 };
    givenBattle(makeTestBattleState({ hand: [card] }));
    const { handleAutoplayCard, handleCardClick } = makeDeps({
      playback: (() => {
        const lifetime = new PlaybackLifetime();
        lifetime.beginAction(lifetime.id);
        return lifetime;
      })(),
    });
    await expect(
      handleAutoplayCard(card, 0, autoplayControl, readBattle(defaultGameSession).battleState),
    ).resolves.toBe(false);
    clickCard(handleCardClick, card, 0);
    expect(readBattle(defaultGameSession).battleState.hand).toHaveLength(1);
    expect(playUISound).not.toHaveBeenCalled();
    expect(battlePresentation.getState().cardRejection).toBeNull();
  });

  it("rejects plays for cards still animating into the hand", () => {
    const slash = slashCard();
    const state = makeTestBattleState({
      hand: [{ ...slash, uid: 6 }],
      mana: 3,
      enemyHealth: 30,
    });
    givenBattle(state);
    battlePresentation.getState().setCardTransferInProgress(true);
    battlePresentation.getState().setHiddenHandCardKeys(() => ["slash-6"]);

    const { awardCardXP, handleCardClick } = makeDeps();
    clickCard(handleCardClick, { ...slash, uid: 6 }, 0);

    expect(readBattle(defaultGameSession).battleState).toEqual(battleSnapshot(state));
    expect(awardCardXP).not.toHaveBeenCalled();
    expect(playUISound).not.toHaveBeenCalled();
    expect(battlePresentation.getState().cardRejection).toBeNull();
  });

  it("plays cards after enemy is defeated during victory grace", () => {
    const slash = slashCard();
    const state = makeTestBattleState({
      hand: [{ ...slash, uid: 4 }],
      mana: 3,
      enemyHealth: 0,
    });
    givenBattle(state);

    const onBattleVictory = vi.fn();
    const { ctx, transferDeps, awardCardXP } = makeDeps({ onBattleVictory });
    const session = createBattleSession(ctx);
    session.handleVictoryDefeat("victory");
    const { handleCardClick } = createBattleCardPlay(ctx, session, transferDeps);
    clickCard(handleCardClick, { ...slash, uid: 4 }, 0);

    expect(readBattle(defaultGameSession).battleState.hand.length).toBe(0);
    expect(readBattle(defaultGameSession).battleState.deck).toEqual([{ ...slash, uid: 4 }]);
    expect(readBattle(defaultGameSession).battleState.discard).toEqual([]);
    expect(readBattle(defaultGameSession).battleState.mana).toBe(2);
    expectAwardedCard(awardCardXP, "slash");
    expect(onBattleVictory).toHaveBeenCalledOnce();
    expect(ctx.playback.canAcceptInput()).toBe(false);
    expect(logError).not.toHaveBeenCalled();
  });

  it.each([1, 2])("unlocks End Turn, autoplay and inspection after %i card draws settle", async (count) => {
    vi.mocked(shouldReduceMotion).mockReturnValue(false);
    const { runBattleDraw } = await import("@/features/alchemy/run-loop/battle/draw-sequence");
    const actual = await vi.importActual<typeof import("@/features/alchemy/run-loop/battle/draw-sequence")>(
      "@/features/alchemy/run-loop/battle/draw-sequence",
    );
    vi.mocked(runBattleDraw).mockImplementation(actual.runBattleDraw);
    try {
      const cards = Array.from({ length: count }, (_, index) =>
        makeTestCard({ id: "quick-study", uid: index + 1, cost: 1, effects: [{ kind: "draw-cards", amount: 1 }] }),
      );
      givenBattle(
        makeTestBattleState({
          hand: cards,
          deck: Array.from({ length: count }, (_, index) => makeTestCard({ id: "slash", uid: index + 99, cost: 1 })),
          mana: count,
          enemyHealth: 30,
        }),
      );
      const { ctx, session, transferDeps, handleCardClick } = makeDeps();
      vi.spyOn(ctx.playback, "waitForFrame").mockResolvedValue(true);
      const finish: Array<() => void> = [];
      const deps = makeDrawSequenceDeps({
        playback: ctx.playback,
        animateDrawnHand: () =>
          new Promise<void>((resolve) => {
            finish.push(resolve);
          }),
        setTransferInProgress: (active) => battlePresentation.getState().setCardTransferInProgress(active),
        setHiddenHandCardKeys: (update) => battlePresentation.getState().setHiddenHandCardKeys(update),
      });
      vi.mocked(transferDeps.getDrawSequenceDeps).mockReturnValue(deps);

      for (const card of cards) clickCard(handleCardClick, { ...card, uid: card.uid! }, 0);
      await vi.waitFor(() => expect(finish).toHaveLength(count));
      expect(readBattle(defaultGameSession).battleState.mana).toBe(0);
      expect(battlePresentation.getState().cardTransferInProgress).toBe(true);
      for (let index = count - 1; index >= 0; index--) {
        finish[index]!();
        await vi.waitFor(() => expect(ctx.playback.pendingCardDraws).toBe(index));
        if (index > 0) {
          expect(ctx.playback.canAcceptInput()).toBe(false);
          expect(battlePresentation.getState().cardTransferInProgress).toBe(true);
        }
      }
      const presentation = battlePresentation.getState();
      const battleState = readBattle(defaultGameSession).battleState;
      expect(ctx.playback.pendingDraws).toBe(0);
      expect(ctx.playback.canAcceptInput()).toBe(true);
      expect(presentation.hiddenHandCardKeys).toEqual([]);
      expect(
        isBattlePlaybackBlocked({
          screen: "battle",
          battleState,
          hasActiveBattle: true,
          cardTransferInProgress: presentation.cardTransferInProgress,
          hiddenHandCardKeys: presentation.hiddenHandCardKeys,
          cardPlayInProgress: ctx.playback.cardPlayInProgress,
        }),
      ).toBe(false);
      expect(
        isBattleInspectionBlocked({
          battleReady: true,
          battleState,
          cardAnimationInProgress: readCardAnimationInProgress(battlePresentation),
          hiddenHandCardKeys: presentation.hiddenHandCardKeys,
        }),
      ).toBe(false);
      const endTurn = vi.fn(() => null);
      const endTurnContext = { ...ctx, battle: { ...ctx.battle, endTurn } };
      createBattleEndTurnUi(endTurnContext, session, transferDeps).handleEndTurn(
        readBattle(defaultGameSession).battleState,
      );
      expect(endTurn).toHaveBeenCalledOnce();
      expect(ctx.playback.scheduleAutoEndTurn).toHaveBeenCalledWith(battleState);
    } finally {
      vi.mocked(shouldReduceMotion).mockReturnValue(true);
      vi.mocked(runBattleDraw).mockImplementation(async (request) => {
        request.onReveal();
        request.onSettled?.();
        return false;
      });
    }
  });

  it("rejects a previewed card when combat is replaced without restarting playback", async () => {
    vi.mocked(shouldReduceMotion).mockReturnValue(false);
    vi.useFakeTimers();

    const slash = slashCard();
    givenBattle(makeTestBattleState({ hand: [{ ...slash, uid: 7 }], mana: 3, enemyHealth: 30 }));

    const { ctx, handleAutoplayCard } = makeDeps();
    const pending = handleAutoplayCard(
      { ...slash, uid: 7 },
      0,
      autoplayControl,
      readBattle(defaultGameSession).battleState,
    );
    const generation = ctx.playback.id;
    givenBattle(makeTestBattleState({ hand: [{ ...slash, uid: 7 }], mana: 3, enemyHealth: 30 }));
    const replacement = readBattle(defaultGameSession).battleState;

    expect(useUiStore.getState().autoplayPreviewCardId).toBe("hand-slash-7");
    expect(useUiStore.getState().shimmerState?.cardId).toBe("hand-slash-7");
    await vi.advanceTimersByTimeAsync(AUTOPLAY_PREVIEW_MS);
    await expect(pending).resolves.toBe(false);
    expect(ctx.playback.id).toBe(generation);
    expect(readBattle(defaultGameSession).battleState).toBe(replacement);
    expect(useUiStore.getState().autoplayPreviewCardId).toBeNull();
    const retry = handleAutoplayCard(
      replacement.hand[0]!,
      0,
      autoplayControl,
      readBattle(defaultGameSession).battleState,
    );
    await vi.advanceTimersByTimeAsync(AUTOPLAY_PREVIEW_MS);
    await expect(retry).resolves.toBe(true);
    expect(readBattle(defaultGameSession).battleState.hand).toHaveLength(0);
  });

  it("flashes a hover preview before autoplaying a wish", async () => {
    vi.mocked(shouldReduceMotion).mockReturnValue(false);
    vi.useFakeTimers();

    const wish = makeTestCard({ id: "strong-wish" });
    givenBattle(makeTestBattleState({ hand: [], mana: 3, enemyHealth: 30, wishOptions: [wish] }));

    const { handleAutoplayWish } = makeDeps();
    const pending = handleAutoplayWish(wish, autoplayControl, readBattle(defaultGameSession).battleState);

    expect(useUiStore.getState().autoplayPreviewCardId).toBe("wish-strong-wish");
    await vi.advanceTimersByTimeAsync(AUTOPLAY_PREVIEW_MS);
    await expect(pending).resolves.toBe(true);
    expect(useUiStore.getState().autoplayPreviewCardId).toBeNull();
    expect(readBattle(defaultGameSession).battleState.wishOptions).toBeNull();
    expect(readBattle(defaultGameSession).battleState.hand.map((card) => card.id)).toEqual([wish.id]);
    expect(playUISound).toHaveBeenCalledWith("selection");
  });

  it.each(["restart", "cancel"] as const)(
    "abandons the autoplay preview immediately on battle %s",
    async (transition) => {
      vi.mocked(shouldReduceMotion).mockReturnValue(false);
      vi.useFakeTimers();

      const slash = slashCard();
      givenBattle(makeTestBattleState({ hand: [{ ...slash, uid: 7 }], mana: 3, enemyHealth: 30 }));

      const { ctx, awardCardXP, handleAutoplayCard } = makeDeps();

      const pending = handleAutoplayCard(
        { ...slash, uid: 7 },
        0,
        autoplayControl,
        readBattle(defaultGameSession).battleState,
      );
      expect(useUiStore.getState().autoplayPreviewCardId).toBe("hand-slash-7");

      ctx.playback[transition]();
      expect(useUiStore.getState().autoplayPreviewCardId).toBeNull();
      expect(vi.getTimerCount()).toBe(0);
      await vi.advanceTimersByTimeAsync(AUTOPLAY_PREVIEW_MS);
      await expect(pending).resolves.toBe(false);
      expect(useUiStore.getState().autoplayPreviewCardId).toBeNull();
      expect(readBattle(defaultGameSession).battleState.hand).toHaveLength(1);
      expect(awardCardXP).not.toHaveBeenCalled();
    },
  );

  it("does not borrow a replacement generation when a preview observer restarts battle", async () => {
    vi.mocked(shouldReduceMotion).mockReturnValue(false);
    vi.useFakeTimers();
    const slash = { ...slashCard(), uid: 7 };
    givenBattle(makeTestBattleState({ hand: [slash], mana: 3, enemyHealth: 30 }));
    const { ctx, handleAutoplayCard } = makeDeps();
    const unsubscribe = useUiStore.subscribe((state, previous) => {
      if (state.autoplayPreviewCardId && state.autoplayPreviewCardId !== previous.autoplayPreviewCardId)
        ctx.playback.restart();
    });
    try {
      const pending = handleAutoplayCard(slash, 0, autoplayControl, readBattle(defaultGameSession).battleState);
      expect(ctx.playback.pendingTimers).toBe(0);
      expect(useUiStore.getState().autoplayPreviewCardId).toBeNull();
      await expect(pending).resolves.toBe(false);
      expect(readBattle(defaultGameSession).battleState.hand).toHaveLength(1);
    } finally {
      unsubscribe();
    }
  });

  it("does not grant a previewed Wish after cancellation without a generation change", async () => {
    vi.mocked(shouldReduceMotion).mockReturnValue(false);
    vi.useFakeTimers();

    const offered = makeTestCard({ id: "slash" });
    givenBattle(makeTestBattleState({ wishOptions: [offered] }));
    const before = readBattle(defaultGameSession).battleState;
    const { ctx, handleAutoplayWish } = makeDeps();
    const pending = handleAutoplayWish(
      before.wishOptions![0]!,
      autoplayControl,
      readBattle(defaultGameSession).battleState,
    );
    const generation = ctx.playback.id;
    ctx.playback.cancel();
    expect(ctx.playback.id).toBe(generation);
    await expect(pending).resolves.toBe(false);
    expect(readBattle(defaultGameSession).battleState).toBe(before);
    expect(useUiStore.getState().autoplayPreviewCardId).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["disabled", "menu", "unmount"] as const)(
    "does not commit a previewed card after autoplay is interrupted: %s",
    async (interruption) => {
      vi.mocked(shouldReduceMotion).mockReturnValue(false);
      vi.useFakeTimers();
      const slash = makeTestCard({ id: "slash", uid: 7, cost: 1 });
      const initialState = makeTestBattleState({ hand: [slash], mana: 3, enemyHealth: 30 });
      givenBattle(initialState);
      const { ctx, handleAutoplayCard, handleAutoplayWish } = makeDeps();
      const gate = {
        current: { hiddenHandCardKeys: [], cardTransferInProgress: false },
      };
      const { rerender, unmount } = renderHook(
        ({ enabled, gameMenuOpen }) =>
          useBattleAutoplay({
            enabled,
            gameMenuOpen,
            screen: "battle",
            hasActiveBattle: true,
            battleState: readBattle(defaultGameSession).battleState,
            isCardPlayInProgress: () => ctx.playback.cardPlayInProgress,
            playCard: handleAutoplayCard,
            playWish: handleAutoplayWish,
            presentationGateRef: gate,
          }),
        { initialProps: { enabled: true, gameMenuOpen: false } },
      );
      using _scopeCleanup = createCleanup(() => {
        unmount();
        vi.useRealTimers();
        vi.mocked(shouldReduceMotion).mockReturnValue(true);
      });

      expect(useUiStore.getState().autoplayPreviewCardId).toBe("hand-slash-7");
      if (interruption === "unmount") unmount();
      else rerender({ enabled: interruption !== "disabled", gameMenuOpen: interruption === "menu" });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(AUTOPLAY_PREVIEW_MS);
      });
      expect(readBattle(defaultGameSession).battleState).toEqual(battleSnapshot(initialState));
      expect(awardCardXP).not.toHaveBeenCalled();
      expect(useUiStore.getState().autoplayPreviewCardId).toBeNull();
      if (interruption !== "unmount") {
        rerender({ enabled: true, gameMenuOpen: false });
        await act(async () => {
          await vi.advanceTimersByTimeAsync(AUTOPLAY_PREVIEW_MS + 50);
        });
        expect(readBattle(defaultGameSession).battleState.hand).toHaveLength(0);
      }
    },
  );

  it("clears a stale autoplay preview on manual play", () => {
    const slash = slashCard();
    givenBattle(makeTestBattleState({ hand: [{ ...slash, uid: 9 }], mana: 3, enemyHealth: 30 }));
    useUiStore.getState().setAutoplayPreviewCardId("hand-slash-9");

    const { handleCardClick } = makeDeps();
    clickCard(handleCardClick, { ...slash, uid: 9 }, 0);

    expect(useUiStore.getState().autoplayPreviewCardId).toBeNull();
    expect(readBattle(defaultGameSession).battleState.hand).toHaveLength(0);
  });

  it("does not telegraph a player lunge for non-damage cards", () => {
    const guard = makeTestCard({
      id: "guard",
      cost: 1,
      effects: [{ kind: "player-status", status: "block", amount: 5 }],
    });
    const state = makeTestBattleState({
      hand: [{ ...guard, uid: 8 }],
      mana: 3,
      enemyHealth: 30,
    });
    givenBattle(state);

    const { handleCardClick } = makeDeps();
    clickCard(handleCardClick, { ...guard, uid: 8 }, 0);

    expect(battlePresentation.getState().playerAttackToken).toBe(0);
    expect(battlePresentation.getState().playerCastToken).toBe(1);
  });
});
