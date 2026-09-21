import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createStore } from "zustand/vanilla";
import { COMBAT_TEXT_LIFETIME_MS, SHAKE_DURATION_MS } from "@/lib/game-constants";
import { createCombatFeedback, createCombatFeedbackState } from "@/features/alchemy/run-loop/battle/combat-feedback";

function makeFeedback() {
  const store = createStore(createCombatFeedbackState);
  const feedback = createCombatFeedback({
    update: (reduce) => store.setState(reduce),
    isVisible: () => true,
    now: () => Date.now(),
  });
  return {
    store,
    ...feedback.actions,
    reset: () => {
      feedback.cancel();
      store.setState(createCombatFeedbackState());
    },
  };
}

const hit = [{ target: "enemy", kind: "damage", stat: "physical", amount: 5 }] as const;

describe("combat feedback lifetime", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("isolates cancellation and expiry between feedback owners", () => {
    const first = makeFeedback();
    const second = makeFeedback();
    first.showCombatTexts([...hit]);
    second.showCombatTexts([...hit]);
    first.shakeEnemy();
    second.shakeEnemy();
    first.reset();
    expect(first.store.getState()).toEqual(createCombatFeedbackState());
    expect(second.store.getState().enemyShaking).toBe(true);
    expect(second.store.getState().floatingCombatBursts).toHaveLength(1);
    vi.advanceTimersByTime(SHAKE_DURATION_MS);
    expect(second.store.getState().enemyShaking).toBe(false);
    vi.advanceTimersByTime(COMBAT_TEXT_LIFETIME_MS);
    expect(second.store.getState().floatingCombatBursts).toEqual([]);
  });

  it("clears text independently without cancelling the active shake", () => {
    const feedback = makeFeedback();
    feedback.shakePlayer();
    feedback.showCombatTexts([...hit]);
    feedback.clearFloatingCombatTexts();
    expect(feedback.store.getState().floatingCombatBursts).toEqual([]);
    expect(feedback.store.getState().enemyImpactCue).toBeNull();
    expect(feedback.store.getState().playerShaking).toBe(true);
    vi.advanceTimersByTime(SHAKE_DURATION_MS);
    expect(feedback.store.getState().playerShaking).toBe(false);
  });

  it("leaves no timed work when a subscriber resets during publication", () => {
    const feedback = makeFeedback();
    feedback.store.subscribe((state) => {
      if (state.floatingCombatBursts.length || state.enemyShaking) feedback.reset();
    });
    feedback.showCombatTexts([...hit]);
    feedback.shakeEnemy();
    expect(feedback.store.getState()).toEqual(createCombatFeedbackState());
    expect(vi.getTimerCount()).toBe(0);
  });
});
