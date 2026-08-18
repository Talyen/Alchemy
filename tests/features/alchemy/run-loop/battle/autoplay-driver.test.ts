import { afterEach, describe, expect, it, vi } from "vitest";
import {
  driveAutoplay,
  findFirstPlayableHandCard,
  isBattlePlayInputBusy,
  isBattlePlaybackBlocked,
} from "@/features/alchemy/run-loop/battle/autoplay-driver";
import { makeTestBattleState, makeTestCard } from "../../../../fixtures/battle";
import { makeEmptyHandBattle, makeOpenBattle, playableCard } from "./open-battle-fixture";

function cheapCard(uid: number) {
  return {
    ...makeTestCard({
      id: "slash",
      cost: 1,
      effects: [{ kind: "damage", damageType: "physical", amount: 6 }],
    }),
    uid,
  };
}

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
    const cheap = cheapCard(2);
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
    vi.useRealTimers();
  });

  it("plays cards in hand order until disabled", async () => {
    const playable = [cheapCard(1), cheapCard(2)];
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
    const playable = cheapCard(1);
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
    const playable = [cheapCard(1), cheapCard(2)];
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
      findPlayableCard: () => ({ card: cheapCard(1), index: 0 }),
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
});
