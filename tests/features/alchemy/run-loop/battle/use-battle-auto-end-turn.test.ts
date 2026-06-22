// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBattleAutoEndTurn } from "@/features/alchemy/run-loop/battle/use-battle-auto-end-turn";
import { createTestBattleState } from "../../../../lib/battle/test-state";
import { makeTestCard } from "../../../../fixtures/battle";
import { AUTO_END_TURN_DELAY } from "@/lib/game-constants";

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
    const battleState = createTestBattleState({
      hand: [{ ...expensive, uid: 1 }],
      mana: 1,
      turnPhase: "player",
      enemyHealth: 20,
    });

    renderHook(() =>
      useBattleAutoEndTurn({
        autoEndTurn: true,
        screen: "battle",
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
    const battleState = createTestBattleState({
      hand: [{ ...slash, uid: 2 }],
      mana: 3,
      turnPhase: "player",
      enemyHealth: 20,
    });

    renderHook(() =>
      useBattleAutoEndTurn({
        autoEndTurn: true,
        screen: "battle",
        battleState,
        onEndTurn,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(AUTO_END_TURN_DELAY + 100);
    });

    expect(onEndTurn).not.toHaveBeenCalled();
  });
});
