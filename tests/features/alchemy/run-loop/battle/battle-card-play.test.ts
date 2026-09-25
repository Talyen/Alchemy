import { PlaybackLifetime } from "@/features/alchemy/run-loop/battle/playback-lifetime";
import { act, renderHook } from "@testing-library/react";
import { useBattleAutoplay } from "@/features/alchemy/run-loop/battle/use-battle-autoplay";
import { battleSnapshot } from "@/lib/battle";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import "../../../../helpers/mock-audio";
import { describe, expect, it, vi, beforeEach, type Mock } from "vitest";
import type { MouseEvent } from "react";
import { createBattleCardPlay } from "@/features/alchemy/run-loop/battle/battle-card-play";
import type { BattleControllerContext } from "@/features/alchemy/run-loop/battle/battle-context";
import { createBattleSession } from "@/features/alchemy/run-loop/battle/battle-session";
import type { createBattleTransferDeps } from "@/features/alchemy/run-loop/battle/draw-sequence";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { readBattle } from "@/features/alchemy/shared/stores/run-reads";
import { setSyncedBattleState } from "@/features/alchemy/shared/stores/write/run-battle";
import { resetBattlePresentationAndRun } from "./battle-test-reset";
import { makeTestBattleState } from "../../../../fixtures/battle";
import { makeTestCard } from "../../../../fixtures/battle";
import { playBattleEvent, playCardSound, playUISound } from "@/lib/audio";
import { AUTOPLAY_PREVIEW_MS } from "@/lib/game-constants";
import { logError } from "@/lib/error-logger";
import { useBattlePresentationStore } from "@/features/alchemy/run-loop/battle/battle-presentation-store";

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

vi.mock("@/features/alchemy/shared/stores/run-session-write-port", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/alchemy/shared/stores/run-session-write-port")>()),
  awardCardXP: vi.fn(),
}));

// Autoplay previews are timing-sensitive; default to reduced motion so existing
// tests keep their synchronous shape. Preview tests opt back into motion below.
vi.mock("@/lib/animation/animation-prefs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/animation/animation-prefs")>()),
  shouldReduceMotion: vi.fn(() => true),
}));

import { shouldReduceMotion } from "@/lib/animation/animation-prefs";

import { awardCardXP } from "@/features/alchemy/shared/stores/run-session-write-port";

const autoplayControl = { signal: new AbortController().signal, canCommit: () => true };

function makeDeps(overrides: Partial<BattleControllerContext> = {}) {
  const playback = new PlaybackLifetime();
  playback.restart();
  const scheduleAutoEndTurnMock = vi.spyOn(playback, "scheduleAutoEndTurn");
  const ctx = {
    screen: "battle" as const,
    playback,
    handCardRefs: { current: {} },
    playerPanelRef: { current: null },
    enemyPanelRef: { current: null },
    battleSceneRef: { current: null },
    setHoveredCardId: vi.fn(),
    talents: { talentEffects: {} },
    scheduleAutoEndTurn: scheduleAutoEndTurnMock,
    logBattleError: vi.fn(),
    getPresentation: () => useBattlePresentationStore.getState(),
    ...overrides,
  } as unknown as BattleControllerContext;

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

  return { ctx, session, transferDeps, awardCardXP: vi.mocked(awardCardXP) };
}

function expectAwardedCard(awardCardXP: Mock, cardId: string) {
  expect(awardCardXP).toHaveBeenCalled();
  expect(awardCardXP.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ id: cardId }));
}

function clickCard(
  handleCardClick: ReturnType<typeof createBattleCardPlay>["handleCardClick"],
  card: ReturnType<typeof makeTestCard> & { uid: number },
  index: number,
) {
  const button = document.createElement("button");
  Object.defineProperty(button, "getBoundingClientRect", {
    value: () => ({
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      top: 0,
      left: 0,
      right: 10,
      bottom: 10,
      toJSON: () => ({}),
    }),
  });
  handleCardClick(card, index, { currentTarget: button } as unknown as MouseEvent<HTMLButtonElement>);
}

beforeEach(() => {
  vi.clearAllMocks();
  resetBattlePresentationAndRun();
  useUiStore.getState().setCardInspection(null);
});

describe("createBattleCardPlay", () => {
  it.each([
    { burn: 0, playsCleanseSound: false },
    { burn: 3, playsCleanseSound: true },
  ])("plays the Cleanse cue only when a status is removed (Burn $burn)", ({ burn, playsCleanseSound }) => {
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
    dispatchRunSessionCommand((draft) => setSyncedBattleState(draft, state));

    const { ctx, session, transferDeps } = makeDeps();
    clickCard(createBattleCardPlay(ctx, session, transferDeps).handleCardClick, { ...cleanse, uid: 1 }, 0);

    expect(playCardSound).toHaveBeenCalledTimes(playsCleanseSound ? 1 : 0);
  });

  it("plays a legal card and syncs battle state", async () => {
    const slash = makeTestCard({
      id: "slash",
      cost: 1,
      effects: [{ kind: "damage", damageType: "physical", amount: 6 }],
    });
    const state = makeTestBattleState({
      hand: [{ ...slash, uid: 1 }],
      mana: 3,
      enemyHealth: 30,
    });
    dispatchRunSessionCommand((draft) => setSyncedBattleState(draft, state));

    const { ctx, session, transferDeps, awardCardXP } = makeDeps();
    const { handleCardClick } = createBattleCardPlay(ctx, session, transferDeps);
    clickCard(handleCardClick, { ...slash, uid: 1 }, 0);

    expect(readBattle().battleState.hand.length).toBe(0);
    expect(readBattle().battleState.enemyHealth).toBeLessThan(30);
    await vi.waitFor(() => {
      expect(ctx.playback.scheduleAutoEndTurn).toHaveBeenCalled();
    });
    expectAwardedCard(awardCardXP, "slash");
    expect(playBattleEvent).toHaveBeenCalledWith("enemyHit");
    expect(playUISound).not.toHaveBeenCalled();
    expect(logError).not.toHaveBeenCalled();
    expect(useBattlePresentationStore.getState().playerAttackToken).toBe(1);
  });

  it("rejects stale manual and autoplay callbacks while inspecting", async () => {
    const slash = { ...makeTestCard({ id: "slash", cost: 1 }), uid: 1 };
    const state = makeTestBattleState({ hand: [slash], mana: 3, enemyHealth: 30 });
    dispatchRunSessionCommand((draft) => setSyncedBattleState(draft, state));
    const { ctx, session, transferDeps, awardCardXP } = makeDeps();
    const { handleCardClick, handleAutoplayCard } = createBattleCardPlay(ctx, session, transferDeps);
    useUiStore.getState().setCardInspection("deck");
    clickCard(handleCardClick, slash, 0);
    await expect(handleAutoplayCard(slash, 0, autoplayControl)).resolves.toBe(false);
    expect(readBattle().battleState).toEqual(battleSnapshot(state));
    expect(awardCardXP).not.toHaveBeenCalled();
  });

  it("rejects plays when mana is insufficient", () => {
    const expensive = makeTestCard({
      id: "meteor",
      cost: 5,
      effects: [{ kind: "damage", damageType: "burn", amount: 20 }],
    });
    const state = makeTestBattleState({
      hand: [{ ...expensive, uid: 2 }],
      mana: 1,
    });
    dispatchRunSessionCommand((draft) => setSyncedBattleState(draft, state));

    const { ctx, session, transferDeps, awardCardXP } = makeDeps();
    const { handleCardClick } = createBattleCardPlay(ctx, session, transferDeps);
    clickCard(handleCardClick, { ...expensive, uid: 2 }, 0);

    expect(readBattle().battleState).toEqual(battleSnapshot(state));
    expect(ctx.playback.scheduleAutoEndTurn).not.toHaveBeenCalled();
    expect(awardCardXP).not.toHaveBeenCalled();
    expect(playUISound).toHaveBeenCalledWith("error");
    expect(useBattlePresentationStore.getState().playerAttackToken).toBe(0);
  });

  it("rejects plays when the player is defeated", () => {
    const slash = makeTestCard({
      id: "slash",
      cost: 1,
      effects: [{ kind: "damage", damageType: "physical", amount: 6 }],
    });
    const state = makeTestBattleState({
      hand: [{ ...slash, uid: 3 }],
      mana: 3,
      playerHealth: 0,
      deathsDoorActive: false,
    });
    dispatchRunSessionCommand((draft) => setSyncedBattleState(draft, state));

    const { ctx, session, transferDeps } = makeDeps();
    const { handleCardClick } = createBattleCardPlay(ctx, session, transferDeps);
    clickCard(handleCardClick, { ...slash, uid: 3 }, 0);

    expect(readBattle().battleState.enemyHealth).toBe(state.enemyHealth);
    expect(playUISound).toHaveBeenCalledWith("error");
  });

  it("plays visible cards while a card transfer is in progress", () => {
    const slash = makeTestCard({
      id: "slash",
      cost: 1,
      effects: [{ kind: "damage", damageType: "physical", amount: 6 }],
    });
    const state = makeTestBattleState({
      hand: [{ ...slash, uid: 5 }],
      mana: 3,
      enemyHealth: 30,
    });
    dispatchRunSessionCommand((draft) => setSyncedBattleState(draft, state));
    useBattlePresentationStore.getState().setCardTransferInProgress(true);

    const { ctx, session, transferDeps, awardCardXP } = makeDeps();
    const { handleCardClick } = createBattleCardPlay(ctx, session, transferDeps);
    clickCard(handleCardClick, { ...slash, uid: 5 }, 0);

    expect(readBattle().battleState.hand).toHaveLength(0);
    expect(readBattle().battleState.mana).toBe(2);
    expectAwardedCard(awardCardXP, "slash");
    expect(playUISound).not.toHaveBeenCalled();
  });

  it("accepts rapid plays by identity and waits for all draws before settling the latest state", async () => {
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
    dispatchRunSessionCommand((draft) =>
      setSyncedBattleState(
        draft,
        makeTestBattleState({
          hand: [first, second],
          mana: 3,
          enemyHealth: 100,
        }),
      ),
    );
    const { ctx, session, transferDeps } = makeDeps();
    const { handleAutoplayCard } = createBattleCardPlay(ctx, session, transferDeps);
    await expect(handleAutoplayCard(first, 0, autoplayControl)).resolves.toBe(true);
    await expect(handleAutoplayCard(second, 1, autoplayControl)).resolves.toBe(true);
    expect(readBattle().battleState.mana).toBe(1);
    expect(readBattle().battleState.hand).toHaveLength(0);
    await expect(handleAutoplayCard(first, 0, autoplayControl)).resolves.toBe(false);
    settled[1]!();
    expect(ctx.playback.cardPlayInProgress).toBe(true);
    expect(session.checkBattleEnd).toHaveBeenCalledTimes(2);
    settled[0]!();
    expect(ctx.playback.cardPlayInProgress).toBe(false);
    expect(session.checkBattleEnd).toHaveBeenCalledWith(readBattle().battleState, 1);
    expect(ctx.playback.scheduleAutoEndTurn).toHaveBeenCalledWith(readBattle().battleState);
    expect(playUISound).not.toHaveBeenCalled();
  });

  it("keeps the hand closed once End Turn has started", async () => {
    const card = makeTestCard({ id: "slash", uid: 1, cost: 0 });
    dispatchRunSessionCommand((draft) => setSyncedBattleState(draft, makeTestBattleState({ hand: [card] })));
    const { ctx, session, transferDeps } = makeDeps({
      playback: (() => {
        const lifetime = new PlaybackLifetime();
        lifetime.beginAction();
        return lifetime;
      })(),
    });
    const actions = createBattleCardPlay(ctx, session, transferDeps);
    await expect(actions.handleAutoplayCard(card, 0, autoplayControl)).resolves.toBe(false);
    expect(readBattle().battleState.hand).toHaveLength(1);
  });

  it("rejects plays for cards still animating into the hand", () => {
    const slash = makeTestCard({
      id: "slash",
      cost: 1,
      effects: [{ kind: "damage", damageType: "physical", amount: 6 }],
    });
    const state = makeTestBattleState({
      hand: [{ ...slash, uid: 6 }],
      mana: 3,
      enemyHealth: 30,
    });
    dispatchRunSessionCommand((draft) => setSyncedBattleState(draft, state));
    useBattlePresentationStore.getState().setCardTransferInProgress(true);
    useBattlePresentationStore.getState().setHiddenHandCardKeys(() => ["slash-6"]);

    const { ctx, session, transferDeps, awardCardXP } = makeDeps();
    const { handleCardClick } = createBattleCardPlay(ctx, session, transferDeps);
    clickCard(handleCardClick, { ...slash, uid: 6 }, 0);

    expect(readBattle().battleState).toEqual(battleSnapshot(state));
    expect(awardCardXP).not.toHaveBeenCalled();
    expect(playUISound).toHaveBeenCalledWith("error");
  });

  it("plays cards after enemy is defeated during victory grace", () => {
    const slash = makeTestCard({
      id: "slash",
      cost: 1,
      effects: [{ kind: "damage", damageType: "physical", amount: 6 }],
    });
    const state = makeTestBattleState({
      hand: [{ ...slash, uid: 4 }],
      mana: 3,
      enemyHealth: 0,
    });
    dispatchRunSessionCommand((draft) => setSyncedBattleState(draft, state));

    const onBattleVictory = vi.fn();
    const { ctx, transferDeps, awardCardXP } = makeDeps({ onBattleVictory });
    const session = createBattleSession(ctx);
    session.handleVictoryDefeat("victory");
    const { handleCardClick } = createBattleCardPlay(ctx, session, transferDeps);
    clickCard(handleCardClick, { ...slash, uid: 4 }, 0);

    expect(readBattle().battleState.hand.length).toBe(0);
    expect(readBattle().battleState.discard).toHaveLength(1);
    expect(readBattle().battleState.mana).toBe(2);
    expectAwardedCard(awardCardXP, "slash");
    expect(onBattleVictory).toHaveBeenCalledOnce();
    expect(ctx.playback.canAcceptInput()).toBe(false);
    expect(logError).not.toHaveBeenCalled();
  });

  it("autoplays a legal card when the hand DOM ref is missing", async () => {
    const slash = makeTestCard({
      id: "slash",
      cost: 1,
      effects: [{ kind: "damage", damageType: "physical", amount: 6 }],
    });
    const state = makeTestBattleState({
      hand: [{ ...slash, uid: 7 }],
      mana: 3,
      enemyHealth: 30,
    });
    dispatchRunSessionCommand((draft) => setSyncedBattleState(draft, state));

    const { ctx, session, transferDeps, awardCardXP } = makeDeps();
    const { handleAutoplayCard } = createBattleCardPlay(ctx, session, transferDeps);
    const played = await handleAutoplayCard({ ...slash, uid: 7 }, 0, autoplayControl);

    expect(played).toBe(true);
    expect(readBattle().battleState.hand.length).toBe(0);
    expectAwardedCard(awardCardXP, "slash");
    expect(playUISound).not.toHaveBeenCalled();
  });

  it("routes drawn cards through the unified draw helper", async () => {
    const draw = makeTestCard({
      id: "quick-study",
      cost: 1,
      effects: [{ kind: "draw-cards", amount: 1 }],
    });
    const incoming = makeTestCard({ id: "slash", uid: 99 });
    const state = makeTestBattleState({
      hand: [{ ...draw, uid: 1 }],
      deck: [incoming],
      mana: 3,
      enemyHealth: 30,
    });
    dispatchRunSessionCommand((draft) => setSyncedBattleState(draft, state));

    const { ctx, session, transferDeps } = makeDeps();
    const { handleCardClick } = createBattleCardPlay(ctx, session, transferDeps);
    clickCard(handleCardClick, { ...draw, uid: 1 }, 0);

    const { runBattleDraw } = await import("@/features/alchemy/run-loop/battle/draw-sequence");
    expect(vi.mocked(runBattleDraw)).toHaveBeenCalledOnce();
    const request = vi.mocked(runBattleDraw).mock.calls[0]![0];
    expect(request.oldHand).toHaveLength(1);
    expect(request.newState.hand.find((card) => card.id === "slash")).toBeDefined();
    const drawn = readBattle().battleState.hand.find((card) => card.id === "slash");
    expect(drawn).toBeDefined();
    expect(useBattlePresentationStore.getState().playerAttackToken).toBe(0);
  });

  it("flashes a hover preview before autoplaying", async () => {
    vi.mocked(shouldReduceMotion).mockReturnValue(false);
    vi.useFakeTimers();
    try {
      const slash = makeTestCard({
        id: "slash",
        cost: 1,
        effects: [{ kind: "damage", damageType: "physical", amount: 6 }],
      });
      dispatchRunSessionCommand((draft) =>
        setSyncedBattleState(draft, makeTestBattleState({ hand: [{ ...slash, uid: 7 }], mana: 3, enemyHealth: 30 })),
      );

      const { ctx, session, transferDeps } = makeDeps();
      const { handleAutoplayCard } = createBattleCardPlay(ctx, session, transferDeps);
      const pending = handleAutoplayCard({ ...slash, uid: 7 }, 0, autoplayControl);

      expect(useUiStore.getState().autoplayPreviewCardId).toBe("hand-slash-7");
      expect(useUiStore.getState().shimmerState?.cardId).toBe("hand-slash-7");
      await vi.advanceTimersByTimeAsync(AUTOPLAY_PREVIEW_MS);
      await expect(pending).resolves.toBe(true);
      expect(useUiStore.getState().autoplayPreviewCardId).toBeNull();
      expect(readBattle().battleState.hand).toHaveLength(0);
    } finally {
      vi.useRealTimers();
      vi.mocked(shouldReduceMotion).mockReturnValue(true);
    }
  });

  it("autoplay wish commits the chosen wish option to hand", async () => {
    const weak = makeTestCard({
      id: "weak-wish",
      cost: 1,
      effects: [{ kind: "damage", damageType: "physical", amount: 2 }],
    });
    const strong = makeTestCard({
      id: "strong-wish",
      cost: 1,
      effects: [{ kind: "damage", damageType: "physical", amount: 9 }],
    });
    dispatchRunSessionCommand((draft) =>
      setSyncedBattleState(
        draft,
        makeTestBattleState({ hand: [], mana: 3, enemyHealth: 30, wishOptions: [weak, strong] }),
      ),
    );

    const { ctx, session, transferDeps } = makeDeps();
    const { handleAutoplayWish } = createBattleCardPlay(ctx, session, transferDeps);

    await expect(handleAutoplayWish(strong, autoplayControl)).resolves.toBe(true);
    const next = readBattle().battleState;
    expect(next.wishOptions).toBeNull();
    expect(next.hand.map((card) => card.id)).toEqual(["strong-wish"]);
    expect(useUiStore.getState().autoplayPreviewCardId).toBeNull();
  });

  it("autoplay wish rejects an option that is no longer offered", async () => {
    const offered = makeTestCard({
      id: "offered-wish",
      cost: 1,
      effects: [{ kind: "damage", damageType: "physical", amount: 9 }],
    });
    const stale = makeTestCard({
      id: "stale-wish",
      cost: 1,
      effects: [{ kind: "damage", damageType: "physical", amount: 9 }],
    });
    const initialState = makeTestBattleState({ hand: [], mana: 3, enemyHealth: 30, wishOptions: [offered] });
    dispatchRunSessionCommand((draft) => setSyncedBattleState(draft, initialState));

    const { ctx, session, transferDeps } = makeDeps();
    const { handleAutoplayWish } = createBattleCardPlay(ctx, session, transferDeps);

    await expect(handleAutoplayWish(stale, autoplayControl)).resolves.toBe(false);
    expect(readBattle().battleState).toEqual(battleSnapshot(initialState));
    expect(useUiStore.getState().autoplayPreviewCardId).toBeNull();
  });

  it("flashes a hover preview before autoplaying a wish", async () => {
    vi.mocked(shouldReduceMotion).mockReturnValue(false);
    vi.useFakeTimers();
    try {
      const wish = makeTestCard({
        id: "strong-wish",
        cost: 1,
        effects: [{ kind: "damage", damageType: "physical", amount: 9 }],
      });
      dispatchRunSessionCommand((draft) =>
        setSyncedBattleState(draft, makeTestBattleState({ hand: [], mana: 3, enemyHealth: 30, wishOptions: [wish] })),
      );

      const { ctx, session, transferDeps } = makeDeps();
      const { handleAutoplayWish } = createBattleCardPlay(ctx, session, transferDeps);
      const pending = handleAutoplayWish(wish, autoplayControl);

      expect(useUiStore.getState().autoplayPreviewCardId).toBe("wish-strong-wish");
      await vi.advanceTimersByTimeAsync(AUTOPLAY_PREVIEW_MS);
      await expect(pending).resolves.toBe(true);
      expect(useUiStore.getState().autoplayPreviewCardId).toBeNull();
      expect(readBattle().battleState.wishOptions).toBeNull();
    } finally {
      vi.useRealTimers();
      vi.mocked(shouldReduceMotion).mockReturnValue(true);
    }
  });

  it("abandons the autoplay preview when the battle session turns over", async () => {
    vi.mocked(shouldReduceMotion).mockReturnValue(false);
    vi.useFakeTimers();
    try {
      const slash = makeTestCard({
        id: "slash",
        cost: 1,
        effects: [{ kind: "damage", damageType: "physical", amount: 6 }],
      });
      dispatchRunSessionCommand((draft) =>
        setSyncedBattleState(draft, makeTestBattleState({ hand: [{ ...slash, uid: 7 }], mana: 3, enemyHealth: 30 })),
      );

      const { ctx, session, transferDeps, awardCardXP } = makeDeps();
      const { handleAutoplayCard } = createBattleCardPlay(ctx, session, transferDeps);
      const pending = handleAutoplayCard({ ...slash, uid: 7 }, 0, autoplayControl);
      expect(useUiStore.getState().autoplayPreviewCardId).toBe("hand-slash-7");

      ctx.playback.restart();
      await vi.advanceTimersByTimeAsync(AUTOPLAY_PREVIEW_MS);
      await expect(pending).resolves.toBe(false);
      expect(useUiStore.getState().autoplayPreviewCardId).toBeNull();
      expect(readBattle().battleState.hand).toHaveLength(1);
      expect(awardCardXP).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
      vi.mocked(shouldReduceMotion).mockReturnValue(true);
    }
  });

  it.each(["disabled", "menu", "unmount"] as const)(
    "does not commit a previewed card after autoplay is interrupted: %s",
    async (interruption) => {
      vi.mocked(shouldReduceMotion).mockReturnValue(false);
      vi.useFakeTimers();
      const slash = makeTestCard({ id: "slash", uid: 7, cost: 1 });
      const initialState = makeTestBattleState({ hand: [slash], mana: 3, enemyHealth: 30 });
      dispatchRunSessionCommand((draft) => setSyncedBattleState(draft, initialState));
      const { ctx, session, transferDeps } = makeDeps();
      const actions = createBattleCardPlay(ctx, session, transferDeps);
      const gate = { current: { hiddenHandCardKeys: [], cardTransferInProgress: false } };
      const { rerender, unmount } = renderHook(
        ({ enabled, gameMenuOpen }) =>
          useBattleAutoplay({
            enabled,
            gameMenuOpen,
            screen: "battle",
            hasActiveBattle: true,
            battleState: readBattle().battleState,
            isCardPlayInProgress: () => ctx.playback.cardPlayInProgress,
            playCard: actions.handleAutoplayCard,
            playWish: actions.handleAutoplayWish,
            presentationGateRef: gate,
          }),
        { initialProps: { enabled: true, gameMenuOpen: false } },
      );
      try {
        expect(useUiStore.getState().autoplayPreviewCardId).toBe("hand-slash-7");
        if (interruption === "unmount") unmount();
        else rerender({ enabled: interruption !== "disabled", gameMenuOpen: interruption === "menu" });
        await act(async () => {
          await vi.advanceTimersByTimeAsync(AUTOPLAY_PREVIEW_MS);
        });
        expect(readBattle().battleState).toEqual(battleSnapshot(initialState));
        expect(awardCardXP).not.toHaveBeenCalled();
        expect(useUiStore.getState().autoplayPreviewCardId).toBeNull();
        if (interruption !== "unmount") {
          rerender({ enabled: true, gameMenuOpen: false });
          await act(async () => {
            await vi.advanceTimersByTimeAsync(AUTOPLAY_PREVIEW_MS + 50);
          });
          expect(readBattle().battleState.hand).toHaveLength(0);
        }
      } finally {
        unmount();
        vi.useRealTimers();
        vi.mocked(shouldReduceMotion).mockReturnValue(true);
      }
    },
  );

  it("clears a stale autoplay preview on manual play", () => {
    const slash = makeTestCard({
      id: "slash",
      cost: 1,
      effects: [{ kind: "damage", damageType: "physical", amount: 6 }],
    });
    dispatchRunSessionCommand((draft) =>
      setSyncedBattleState(draft, makeTestBattleState({ hand: [{ ...slash, uid: 9 }], mana: 3, enemyHealth: 30 })),
    );
    useUiStore.getState().setAutoplayPreviewCardId("hand-slash-9");

    const { ctx, session, transferDeps } = makeDeps();
    const { handleCardClick } = createBattleCardPlay(ctx, session, transferDeps);
    clickCard(handleCardClick, { ...slash, uid: 9 }, 0);

    expect(useUiStore.getState().autoplayPreviewCardId).toBeNull();
    expect(readBattle().battleState.hand).toHaveLength(0);
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
    dispatchRunSessionCommand((draft) => setSyncedBattleState(draft, state));

    const { ctx, session, transferDeps } = makeDeps();
    const { handleCardClick } = createBattleCardPlay(ctx, session, transferDeps);
    clickCard(handleCardClick, { ...guard, uid: 8 }, 0);

    expect(useBattlePresentationStore.getState().playerAttackToken).toBe(0);
    expect(useBattlePresentationStore.getState().playerCastToken).toBe(1);
  });
});
