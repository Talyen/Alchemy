import { afterEach, describe, expect, it, vi } from "vitest";
import {
  driveAutoplay,
  findFirstPlayableHandCard,
  isBattlePlayInputBusy,
  isBattlePlaybackBlocked,
} from "@/features/alchemy/run-loop/battle/autoplay-driver";
import * as animationPrefs from "@/lib/animation/animation-prefs";
import { makeTestBattleState, makeTestCard } from "../../../../fixtures/battle";
import { makeEmptyHandBattle, makeOpenBattle, playableCard } from "./open-battle-fixture";

describe("isBattlePlayInputBusy", () => {
  it("is busy during a play commit or a card transfer", () => {
    expect(isBattlePlayInputBusy({ cardPlayInProgress: false, cardTransferInProgress: false })).toBe(false);
    expect(isBattlePlayInputBusy({ cardPlayInProgress: true, cardTransferInProgress: false })).toBe(true);
    expect(isBattlePlayInputBusy({ cardPlayInProgress: false, cardTransferInProgress: true })).toBe(true);
  });
});

describe("isBattlePlaybackBlocked", () => {
  const openBattle = makeOpenBattle();

  it("allows an open player turn", () => {
    expect(isBattlePlaybackBlocked(openBattle)).toBe(false);
  });

  it("blocks while a matching hand card is hidden", () => {
    expect(isBattlePlaybackBlocked({ ...openBattle, hiddenHandCardKeys: ["slash-1"] })).toBe(true);
  });

  it("does not block on hidden keys that are not in the current hand", () => {
    expect(
      isBattlePlaybackBlocked({
        ...makeEmptyHandBattle(),
        hiddenHandCardKeys: ["slash-1"],
      }),
    ).toBe(false);
  });

  it("blocks while a card transfer is in progress", () => {
    expect(isBattlePlaybackBlocked({ ...openBattle, cardTransferInProgress: true })).toBe(true);
  });

  it("blocks when the game menu is open", () => {
    expect(isBattlePlaybackBlocked({ ...openBattle, gameMenuOpen: true })).toBe(true);
  });

  it("blocks when wish options are showing", () => {
    expect(
      isBattlePlaybackBlocked({
        ...openBattle,
        battleState: { ...openBattle.battleState, wishOptions: [{ ...playableCard, uid: 2 }] },
      }),
    ).toBe(true);
  });
});

describe("findFirstPlayableHandCard", () => {
  it("returns the first affordable card in hand order", () => {
    const expensive = {
      ...makeTestCard({
        id: "meteor",
        cost: 9,
        effects: [{ kind: "damage", damageType: "burn", amount: 20 }],
      }),
      uid: 1,
    };
    const cheap = { ...playableCard, uid: 2 };
    const state = makeTestBattleState({
      hand: [expensive, cheap],
      mana: 1,
      turnPhase: "player",
    });

    expect(findFirstPlayableHandCard(state)?.card.uid).toBe(2);
  });
});

describe("driveAutoplay", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("plays cards in hand order until disabled", async () => {
    const playable = [
      { ...playableCard, uid: 1 },
      { ...playableCard, uid: 2 },
    ];
    const played: number[] = [];
    const controller = new AbortController();

    await driveAutoplay({
      signal: controller.signal,
      delayMs: 0,
      postPlayDelayMs: 0,
      isEnabled: () => played.length < playable.length,
      isBlocked: () => false,
      findPlayableCard: () => {
        const remaining = playable.filter((card) => !played.includes(card.uid));
        const card = remaining[0];
        return card ? { card, index: 0 } : null;
      },
      playCard: (card) => {
        played.push(card.uid ?? 0);
        return true;
      },
    });

    expect(played).toEqual([1, 2]);
  });

  it("retries after a rejected play instead of stopping", async () => {
    const playable = { ...playableCard, uid: 1 };
    let attempts = 0;
    const played: number[] = [];
    const controller = new AbortController();

    await driveAutoplay({
      signal: controller.signal,
      delayMs: 0,
      postPlayDelayMs: 0,
      isEnabled: () => played.length < 1 && attempts < 5,
      isBlocked: () => false,
      findPlayableCard: () => ({ card: playable, index: 0 }),
      playCard: (card) => {
        attempts += 1;
        if (attempts === 1) return false;
        played.push(card.uid ?? 0);
        return true;
      },
    });

    expect(attempts).toBeGreaterThan(1);
    expect(played).toEqual([1]);
  });

  it("waits the post-play delay before playing the next card", async () => {
    vi.useFakeTimers();
    const playable = [
      { ...playableCard, uid: 1 },
      { ...playableCard, uid: 2 },
    ];
    const played: number[] = [];
    const controller = new AbortController();

    const done = driveAutoplay({
      signal: controller.signal,
      delayMs: 0,
      postPlayDelayMs: 1000,
      isEnabled: () => played.length < playable.length,
      isBlocked: () => false,
      findPlayableCard: () => {
        const remaining = playable.filter((card) => !played.includes(card.uid));
        const card = remaining[0];
        return card ? { card, index: 0 } : null;
      },
      playCard: (card) => {
        played.push(card.uid ?? 0);
        return true;
      },
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(played).toEqual([1]);

    await vi.advanceTimersByTimeAsync(999);
    expect(played).toEqual([1]);

    await vi.advanceTimersByTimeAsync(1);
    expect(played).toEqual([1, 2]);

    await vi.advanceTimersByTimeAsync(1000);
    await done;
  });

  it("short-circuits a retry wait when wakeRef fires", async () => {
    vi.useFakeTimers();
    const wakeRef: { current: (() => void) | null } = { current: null };
    let blocked = true;
    const played: number[] = [];
    const controller = new AbortController();

    const done = driveAutoplay({
      signal: controller.signal,
      delayMs: 1000,
      postPlayDelayMs: 0,
      wakeRef,
      isEnabled: () => played.length < 1,
      isBlocked: () => blocked,
      findPlayableCard: () => ({ card: { ...playableCard, uid: 1 }, index: 0 }),
      playCard: (card) => {
        played.push(card.uid ?? 0);
        return true;
      },
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(played).toEqual([]);
    expect(wakeRef.current).toEqual(expect.any(Function));

    blocked = false;
    await Promise.resolve();
    wakeRef.current?.();
    await vi.advanceTimersByTimeAsync(0);

    expect(played).toEqual([1]);
    controller.abort();
    await done;
  });

  function startTimedAutoplay(blockedAfterPlay = false) {
    vi.useFakeTimers();
    const controller = new AbortController();
    const wakeRef: { current: (() => void) | null } = { current: null };
    const state = { blocked: false };
    const playCard = vi.fn(() => {
      state.blocked = blockedAfterPlay;
      return true;
    });
    const done = driveAutoplay({
      signal: controller.signal,
      delayMs: 100,
      postPlayDelayMs: 1000,
      wakeRef,
      isEnabled: () => true,
      isBlocked: () => state.blocked,
      findPlayableCard: () => ({ card: playableCard, index: 0 }),
      playCard,
    });
    return { controller, wakeRef, state, playCard, done };
  }

  it.each([1, 3])("preserves pacing through %s wake notifications", async (wakeCount) => {
    const run = startTimedAutoplay();
    for (let i = 0; i < wakeCount; i++) {
      await vi.advanceTimersByTimeAsync(100);
      run.wakeRef.current?.();
      await vi.advanceTimersByTimeAsync(0);
      expect(run.playCard).toHaveBeenCalledOnce();
    }
    await vi.advanceTimersByTimeAsync(999 - wakeCount * 100);
    expect(run.playCard).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    expect(run.playCard).toHaveBeenCalledTimes(2);
    run.controller.abort();
    await run.done;
  });

  it.each([450, 1450])("counts a %s ms transfer toward the post-play delay", async (transferMs) => {
    const run = startTimedAutoplay(true);
    await vi.advanceTimersByTimeAsync(transferMs);
    expect(run.playCard).toHaveBeenCalledOnce();
    run.state.blocked = false;
    run.wakeRef.current?.();
    await vi.advanceTimersByTimeAsync(0);
    if (transferMs < 1000) {
      await vi.advanceTimersByTimeAsync(999 - transferMs);
      expect(run.playCard).toHaveBeenCalledOnce();
      await vi.advanceTimersByTimeAsync(1);
    }
    expect(run.playCard).toHaveBeenCalledTimes(2);
    run.controller.abort();
    await run.done;
  });

  it("rechecks a blocker introduced during the pacing pause", async () => {
    const run = startTimedAutoplay();
    await vi.advanceTimersByTimeAsync(250);
    run.state.blocked = true;
    run.wakeRef.current?.();
    await vi.advanceTimersByTimeAsync(1000);
    expect(run.playCard).toHaveBeenCalledOnce();
    run.state.blocked = false;
    run.wakeRef.current?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(run.playCard).toHaveBeenCalledTimes(2);
    run.controller.abort();
    await run.done;
  });

  it.each([false, true])("cleans up an aborted wait (waiting for readiness: %s)", async (blocked) => {
    const run = startTimedAutoplay(blocked);
    await vi.advanceTimersByTimeAsync(25);
    expect(vi.getTimerCount()).toBe(1);
    if (blocked) expect(run.wakeRef.current).toEqual(expect.any(Function));
    run.controller.abort();
    await run.done;
    expect(run.wakeRef.current).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(2000);
    expect(run.playCard).toHaveBeenCalledOnce();
  });

  it("preserves shortened pacing when animations are disabled", async () => {
    vi.spyOn(animationPrefs, "isAnimationDisabled").mockReturnValue(true);
    const run = startTimedAutoplay();
    run.wakeRef.current?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(run.playCard).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(animationPrefs.ANIMATION_DISABLED_DURATION);
    expect(run.playCard).toHaveBeenCalledTimes(2);
    run.controller.abort();
    await run.done;
  });
});
