import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createStore } from "zustand/vanilla";
import {
  CARD_REJECTION_FEEDBACK_MS,
  COMBAT_RECOIL_COOLDOWN_MS,
  COMBAT_TEXT_LIFETIME_MS,
  SHAKE_DURATION_MS,
} from "@/lib/game-constants";
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

  it("caps rapid recoil while retaining every impact and numeric outcome", () => {
    const feedback = makeFeedback();
    feedback.showCombatTexts([...hit]);
    const first = feedback.store.getState().enemyImpactCue!;
    expect(first.recoil).toBe(true);
    feedback.showCombatTexts([...hit]);
    expect(feedback.store.getState().enemyImpactCue).toMatchObject({ recoil: false, amount: 5 });
    expect(feedback.store.getState().enemyImpactCue!.sequence).toBeGreaterThan(first.sequence);
    expect(feedback.store.getState().floatingCombatBursts[0]!.entries[0]).toMatchObject({ kind: "damage", amount: 10 });
    vi.advanceTimersByTime(COMBAT_RECOIL_COOLDOWN_MS);
    feedback.showCombatTexts([...hit]);
    expect(feedback.store.getState().enemyImpactCue!.recoil).toBe(true);
    feedback.reset();
    feedback.showCombatTexts([...hit]);
    expect(feedback.store.getState().enemyImpactCue!.recoil).toBe(true);
  });

  it("bounds rejection feedback and cancels its lifetime on teardown", () => {
    const feedback = makeFeedback();
    expect(feedback.rejectCardPlay("slash-1", true)).toBe(true);
    expect(feedback.rejectCardPlay("slash-1", true)).toBe(false);
    expect(feedback.store.getState().cardRejection).toEqual({ cardKey: "slash-1", mana: true });
    vi.advanceTimersByTime(CARD_REJECTION_FEEDBACK_MS);
    expect(feedback.store.getState().cardRejection).toBeNull();
    expect(feedback.rejectCardPlay("guard-2", false)).toBe(true);
    feedback.reset();
    expect(feedback.store.getState().cardRejection).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
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
