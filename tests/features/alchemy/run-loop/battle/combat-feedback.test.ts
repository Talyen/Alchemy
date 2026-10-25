import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createStore } from "zustand/vanilla";
import {
  CARD_REJECTION_FEEDBACK_MS,
  COMBAT_RECOIL_COOLDOWN_MS,
  COMBAT_TEXT_LIFETIME_MS,
  REACTION_TEXT_LIFETIME_MS,
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

  it("signals each dodging frame once per action without adding hit feedback or changing its notice", () => {
    const feedback = makeFeedback();
    const playerDodge = { target: "player", kind: "notice", stat: "dodge", text: "Dodge" } as const;
    const enemyDodge = { ...playerDodge, target: "enemy" } as const;
    feedback.showCombatTexts([playerDodge, playerDodge]);
    expect(feedback.store.getState()).toMatchObject({
      playerDodgeToken: 1,
      enemyDodgeToken: 0,
      playerImpactCue: null,
      enemyImpactCue: null,
      playerShaking: false,
      enemyShaking: false,
    });
    expect(feedback.store.getState().floatingCombatBursts).toHaveLength(1);
    expect(feedback.store.getState().floatingCombatBursts[0]!.entries).toEqual([expect.objectContaining(playerDodge)]);
    feedback.showCombatTexts([playerDodge, enemyDodge]);
    expect(feedback.store.getState()).toMatchObject({ playerDodgeToken: 2, enemyDodgeToken: 1 });
    feedback.showCombatTexts([...hit]);
    expect(feedback.store.getState()).toMatchObject({ playerDodgeToken: 2, enemyDodgeToken: 1 });
    feedback.clearFloatingCombatTexts();
    expect(feedback.store.getState()).toMatchObject({ playerDodgeToken: 0, enemyDodgeToken: 0 });
    feedback.showCombatTexts([enemyDodge]);
    expect(feedback.store.getState().enemyDodgeToken).toBe(1);
    feedback.reset();
    expect(feedback.store.getState()).toEqual(createCombatFeedbackState());
    expect(vi.getTimerCount()).toBe(0);
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
      if (state.floatingCombatBursts.length || state.reactionAnnouncements.length || state.enemyShaking)
        feedback.reset();
    });
    feedback.showCombatTexts([...hit]);
    feedback.shakeEnemy();
    expect(feedback.store.getState()).toEqual(createCombatFeedbackState());
    expect(vi.getTimerCount()).toBe(0);
  });
  it("keeps reaction names independent of merged numbers and cancels queued names", () => {
    const feedback = makeFeedback();
    const notice = {
      target: "enemy",
      kind: "notice",
      stat: "physical",
      text: "Shatter",
      signal: "reaction",
      reactionId: "shatter",
    } as const;
    feedback.showCombatTexts([...hit, notice]);
    const first = feedback.store.getState().reactionAnnouncements[0]!;
    vi.advanceTimersByTime(100);
    feedback.showCombatTexts([...hit]);
    expect(feedback.store.getState().reactionAnnouncements[0]).toBe(first);
    vi.advanceTimersByTime(COMBAT_TEXT_LIFETIME_MS - 100);
    expect(feedback.store.getState().floatingCombatBursts).toEqual([]);
    expect(feedback.store.getState().reactionAnnouncements).toEqual([first]);
    vi.advanceTimersByTime(REACTION_TEXT_LIFETIME_MS - COMBAT_TEXT_LIFETIME_MS);
    expect(feedback.store.getState().reactionAnnouncements).toEqual([]);
    for (let i = 0; i < 5; i++) feedback.showCombatTexts([notice]);
    expect(feedback.store.getState().reactionAnnouncements).toHaveLength(5);
    feedback.reset();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("independent combat feedback launches", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("keeps the newer launch deadline when a subscriber admits another result during publication", () => {
    const feedback = makeFeedback();
    let admitted = false;
    feedback.store.subscribe((state) => {
      if (!admitted && state.floatingCombatBursts.length) {
        admitted = true;
        feedback.showCombatTexts([{ target: "enemy", kind: "heal", stat: "health", amount: 8 }]);
      }
    });
    feedback.showCombatTexts([...hit]);
    const healing = feedback.store
      .getState()
      .floatingCombatBursts.flatMap((burst) => burst.entries)
      .find((entry) => entry.kind === "heal")!;
    expect(healing.presentation!.phase).toBe("waiting");
    vi.advanceTimersByTime(healing.presentation!.launchAt - Date.now());
    expect(
      feedback.store
        .getState()
        .floatingCombatBursts.flatMap((burst) => burst.entries)
        .find((entry) => entry.kind === "heal")!.presentation!.phase,
    ).toBe("visible");
    feedback.reset();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("queues healing behind damage while both corners start independently and keeps the launched path stable", () => {
    const feedback = makeFeedback();
    feedback.showCombatTexts([
      ...hit,
      { target: "enemy", kind: "heal", stat: "health", amount: 8 },
      { target: "enemy", kind: "status", stat: "block", amount: 6 },
      { target: "enemy", kind: "notice", stat: "freeze", text: "Frozen" },
    ]);
    const entries = feedback.store.getState().floatingCombatBursts[0]!.entries;
    const damage = entries.find((entry) => entry.kind === "damage")!;
    const healing = entries.find((entry) => entry.kind === "heal")!;
    expect(damage.presentation).toMatchObject({ lane: "impact", phase: "visible" });
    expect(healing.presentation).toMatchObject({ lane: "impact", phase: "waiting" });
    expect(entries.find((entry) => entry.stat === "block")!.presentation).toMatchObject({
      lane: "benefit",
      phase: "visible",
    });
    expect(entries.find((entry) => entry.stat === "freeze")!.presentation).toMatchObject({
      lane: "setback",
      phase: "visible",
    });
    const originalPath = damage.presentation;
    const launch = healing.presentation!.launchAt;
    vi.advanceTimersByTime(100);
    feedback.showCombatTexts([...hit]);
    expect(
      feedback.store.getState().floatingCombatBursts[0]!.entries.find((entry) => entry.kind === "damage")!.presentation,
    ).toBe(originalPath);
    vi.advanceTimersByTime(launch - Date.now());
    expect(
      feedback.store
        .getState()
        .floatingCombatBursts.flatMap((burst) => burst.entries)
        .find((entry) => entry.kind === "heal")!.presentation!.phase,
    ).toBe("visible");
    vi.advanceTimersByTime(COMBAT_TEXT_LIFETIME_MS - 1);
    expect(
      feedback.store
        .getState()
        .floatingCombatBursts.flatMap((burst) => burst.entries)
        .some((entry) => entry.kind === "heal"),
    ).toBe(true);
    vi.advanceTimersByTime(1);
    expect(feedback.store.getState().floatingCombatBursts).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("bounds pending feedback without evicting active text, then clears every launch on reset", () => {
    const feedback = makeFeedback();
    feedback.showCombatTexts([...hit]);
    const active = feedback.store.getState().floatingCombatBursts[0]!.entries[0]!.presentation;
    for (let i = 0; i < 40; i++) feedback.showCombatTexts([{ ...hit[0], additive: false }]);
    const entries = feedback.store.getState().floatingCombatBursts.flatMap((burst) => burst.entries);
    expect(entries.filter((entry) => entry.presentation!.phase === "waiting")).toHaveLength(12);
    expect(entries[0]!.presentation).toBe(active);
    expect(Math.max(...entries.map((entry) => entry.presentation!.launchAt)) - Date.now()).toBeLessThan(15000);
    feedback.clearFloatingCombatTexts();
    vi.advanceTimersByTime(20000);
    expect(feedback.store.getState().floatingCombatBursts).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });
});
