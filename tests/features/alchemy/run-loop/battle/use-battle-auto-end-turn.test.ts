// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBattleAutoEndTurn } from "@/features/alchemy/run-loop/battle/use-battle-auto-end-turn";
import { makeTestBattleState } from "../../../../fixtures/battle";
import { makeTestCard } from "../../../../fixtures/battle";
import { AUTO_END_TURN_DELAY } from "@/lib/game-constants";

const baseOptions = {
  autoEndTurn: true,
  screen: "battle" as const,
  hasActiveBattle: true,
  cardTransferInProgress: false,
  hiddenHandCardKeys: new Set<string>(),
};

describe("useBattleAutoEndTurn", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("schedules end turn when no card is playable", () => {
    const onEndTurn = vi.fn();
    const expensive = makeTestCard({
      id: "meteor",
      cost: 9,
      effects: [{ kind: "damage", damageType: "burn", amount: 20 }],
    });
    const battleState = makeTestBattleState({
      hand: [{ ...expensive, uid: 1 }],
      mana: 1,
      turnPhase: "player",
      enemyHealth: 20,
    });

    renderHook(() =>
      useBattleAutoEndTurn({
        ...baseOptions,
        battleState,
        onEndTurn,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(AUTO_END_TURN_DELAY);
    });

    expect(onEndTurn).toHaveBeenCalledOnce();
  });

  it("does not schedule end turn when a card is playable", () => {
    const onEndTurn = vi.fn();
    const slash = makeTestCard({
      id: "slash",
      cost: 1,
      effects: [{ kind: "damage", damageType: "physical", amount: 5 }],
    });
    const battleState = makeTestBattleState({
      hand: [{ ...slash, uid: 2 }],
      mana: 3,
      turnPhase: "player",
      enemyHealth: 20,
    });

    renderHook(() =>
      useBattleAutoEndTurn({
        ...baseOptions,
        battleState,
        onEndTurn,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(AUTO_END_TURN_DELAY + 100);
    });

    expect(onEndTurn).not.toHaveBeenCalled();
  });

  it("clearAutoEndTurn cancels a pending auto-end timer", () => {
    const onEndTurn = vi.fn();
    const expensive = makeTestCard({
      id: "meteor",
      cost: 9,
      effects: [{ kind: "damage", damageType: "burn", amount: 20 }],
    });
    const battleState = makeTestBattleState({
      hand: [{ ...expensive, uid: 1 }],
      mana: 1,
      turnPhase: "player",
      enemyHealth: 20,
    });

    const { result } = renderHook(() =>
      useBattleAutoEndTurn({
        ...baseOptions,
        battleState,
        onEndTurn,
      }),
    );

    act(() => {
      result.current.clearAutoEndTurn();
      vi.advanceTimersByTime(AUTO_END_TURN_DELAY + 100);
    });

    expect(onEndTurn).not.toHaveBeenCalled();
  });

  it("does not schedule while a hand transfer is in progress", () => {
    const onEndTurn = vi.fn();
    const battleState = makeTestBattleState({
      hand: [],
      mana: 3,
      turnPhase: "player",
      enemyHealth: 20,
    });

    renderHook(() =>
      useBattleAutoEndTurn({
        ...baseOptions,
        cardTransferInProgress: true,
        battleState,
        onEndTurn,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(AUTO_END_TURN_DELAY + 100);
    });

    expect(onEndTurn).not.toHaveBeenCalled();
  });

  it("does not schedule while hand cards are still hidden from draw", () => {
    const onEndTurn = vi.fn();
    const battleState = makeTestBattleState({
      hand: [],
      mana: 3,
      turnPhase: "player",
      enemyHealth: 20,
    });

    renderHook(() =>
      useBattleAutoEndTurn({
        ...baseOptions,
        hiddenHandCardKeys: new Set(["slash-1"]),
        battleState,
        onEndTurn,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(AUTO_END_TURN_DELAY + 100);
    });

    expect(onEndTurn).not.toHaveBeenCalled();
  });

  it("does not schedule when there is no active battle", () => {
    const onEndTurn = vi.fn();
    const battleState = makeTestBattleState({
      hand: [],
      mana: 3,
      turnPhase: "player",
      enemyHealth: 20,
    });

    renderHook(() =>
      useBattleAutoEndTurn({
        ...baseOptions,
        hasActiveBattle: false,
        battleState,
        onEndTurn,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(AUTO_END_TURN_DELAY + 100);
    });

    expect(onEndTurn).not.toHaveBeenCalled();
  });

  it("schedules end turn when the hand only has cleanse cards with nothing to cleanse", () => {
    const onEndTurn = vi.fn();
    const cleanse = makeTestCard({
      id: "cleanse",
      cost: 1,
      effects: [{ kind: "remove-harmful-status", amount: 1 }],
    });
    const battleState = makeTestBattleState({
      hand: [{ ...cleanse, uid: 3 }],
      mana: 5,
      turnPhase: "player",
      enemyHealth: 20,
    });

    renderHook(() =>
      useBattleAutoEndTurn({
        ...baseOptions,
        battleState,
        onEndTurn,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(AUTO_END_TURN_DELAY);
    });

    expect(onEndTurn).toHaveBeenCalledOnce();
  });
});
