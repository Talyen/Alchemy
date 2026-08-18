// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isAutoplayBlocked, useBattleAutoplay } from "@/features/alchemy/run-loop/battle/use-battle-autoplay";
import { makeTestBattleState, makeTestCard } from "../../../../fixtures/battle";
import { AUTOPLAY_RETRY_DELAY_MS } from "@/lib/game-constants";

const playableCard = makeTestCard({
  id: "slash",
  cost: 1,
  effects: [{ kind: "damage", damageType: "physical", amount: 5 }],
});

const openBattle = {
  screen: "battle" as const,
  hasActiveBattle: true,
  cardTransferInProgress: false,
  hiddenHandCardKeys: new Set<string>(),
  cardPlayInProgress: false,
  gameMenuOpen: false,
  battleState: makeTestBattleState({
    hand: [{ ...playableCard, uid: 1 }],
    mana: 3,
    turnPhase: "player",
    enemyHealth: 20,
  }),
};

describe("isAutoplayBlocked", () => {
  it("allows play during an open player turn", () => {
    expect(isAutoplayBlocked(openBattle)).toBe(false);
  });

  it("blocks when the game menu is open", () => {
    expect(isAutoplayBlocked({ ...openBattle, gameMenuOpen: true })).toBe(true);
  });
});

describe("useBattleAutoplay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("plays the first playable card when enabled", () => {
    const playCard = vi.fn(() => true);
    renderHook(() =>
      useBattleAutoplay({
        enabled: true,
        screen: "battle",
        battleState: openBattle.battleState,
        hasActiveBattle: true,
        cardTransferInProgress: false,
        hiddenHandCardKeys: new Set(),
        isCardPlayInProgress: () => false,
        gameMenuOpen: false,
        playCard,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(AUTOPLAY_RETRY_DELAY_MS);
    });

    expect(playCard).toHaveBeenCalled();
  });

  it("does not play while blocked by hidden cards", () => {
    const playCard = vi.fn(() => true);
    renderHook(() =>
      useBattleAutoplay({
        enabled: true,
        screen: "battle",
        battleState: openBattle.battleState,
        hasActiveBattle: true,
        cardTransferInProgress: false,
        hiddenHandCardKeys: new Set(["slash-1"]),
        isCardPlayInProgress: () => false,
        gameMenuOpen: false,
        playCard,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(AUTOPLAY_RETRY_DELAY_MS * 3);
    });

    expect(playCard).not.toHaveBeenCalled();
  });
});
