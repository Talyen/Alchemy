import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createStore } from "zustand/vanilla";
import {
  CARD_REJECTION_FEEDBACK_MS,
  COMBAT_RECOIL_COOLDOWN_MS,
  COMBAT_TEXT_LIFETIME_MS,
  COMBAT_TEXT_MOTION,
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
    first.shakeCompanion();
    second.shakeCompanion();
    first.reset();
    expect(first.store.getState()).toEqual(createCombatFeedbackState());
    expect(second.store.getState().companionShaking).toBe(true);
    expect(second.store.getState().floatingCombatBursts).toHaveLength(1);
    vi.advanceTimersByTime(SHAKE_DURATION_MS);
    expect(second.store.getState().companionShaking).toBe(false);
    vi.advanceTimersByTime(COMBAT_TEXT_LIFETIME_MS);
    expect(second.store.getState().floatingCombatBursts).toEqual([]);
  });

  it("clears text independently without cancelling the active shake", () => {
    const feedback = makeFeedback();
    feedback.shakeCompanion();
    feedback.showCombatTexts([...hit]);
    feedback.clearFloatingCombatTexts();
    expect(feedback.store.getState().floatingCombatBursts).toEqual([]);
    expect(feedback.store.getState().enemyImpactCue).toBeNull();
    expect(feedback.store.getState().companionShaking).toBe(true);
    vi.advanceTimersByTime(SHAKE_DURATION_MS);
    expect(feedback.store.getState().companionShaking).toBe(false);
  });

  it("leaves no timed work when a subscriber resets during publication", () => {
    const feedback = makeFeedback();
    feedback.store.subscribe((state) => {
      if (state.floatingCombatBursts.length || state.reactionAnnouncements.length || state.companionShaking)
        feedback.reset();
    });
    feedback.showCombatTexts([...hit]);
    feedback.shakeCompanion();
    expect(feedback.store.getState()).toEqual(createCombatFeedbackState());
    expect(vi.getTimerCount()).toBe(0);
  });
  it("keeps an attributed group intact when a later ordinary action arrives and cancels queued groups", () => {
    const feedback = makeFeedback();
    const notice = {
      target: "enemy",
      kind: "notice",
      stat: "physical",
      text: "Shatter",
      signal: "reaction",
      reactionId: "shatter",
    } as const;
    feedback.showCombatTexts([{ ...hit[0], reactionId: "shatter" }, notice]);
    const first = feedback.store.getState().reactionAnnouncements[0]!;
    vi.advanceTimersByTime(100);
    feedback.showCombatTexts([...hit]);
    expect(feedback.store.getState().reactionAnnouncements[0]).toBe(first);
    vi.advanceTimersByTime(COMBAT_TEXT_LIFETIME_MS - 100);
    expect(feedback.store.getState().floatingCombatBursts).toHaveLength(1);
    expect(first.entries).toMatchObject([{ amount: 5 }]);
    expect(feedback.store.getState().reactionAnnouncements).toEqual([first]);
    vi.advanceTimersByTime(100);
    expect(feedback.store.getState().floatingCombatBursts).toEqual([]);
    vi.advanceTimersByTime(REACTION_TEXT_LIFETIME_MS - COMBAT_TEXT_LIFETIME_MS - 100);
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
    const queuedPath = healing.presentation;
    vi.advanceTimersByTime(Math.floor((launch - Date.now()) / 2));
    feedback.showCombatTexts([...hit]);
    expect(
      feedback.store
        .getState()
        .floatingCombatBursts.flatMap((burst) => burst.entries)
        .find((entry) => entry.kind === "heal")!.presentation,
    ).toEqual(queuedPath);
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

  it("retains the independent direct flight and a stable named reaction within the launch budget", () => {
    const feedback = makeFeedback();
    const events = [
      { target: "enemy", kind: "notice", stat: "burn", text: "", signal: "reaction", reactionId: "frostfire" },
      {
        target: "enemy",
        kind: "damage",
        stat: "burn",
        amount: 12,
        additive: false,
        reactionId: "frostfire",
        feedback: "secondary",
      },
      { target: "enemy", kind: "damage", stat: "freeze", amount: 8, feedback: "primary" },
    ] as const;
    feedback.showCombatTexts([...events]);
    const group = feedback.store.getState().reactionAnnouncements[0]!;
    expect(feedback.store.getState().floatingCombatBursts[0]!.entries).toMatchObject([
      { amount: 8, stat: "freeze", feedback: "primary", presentation: { lane: "impact" } },
    ]);
    expect(group.entries).toHaveLength(1);
    expect(group.presentation).toMatchObject({ lane: "announcement", phase: "visible", lifetimeMs: 1600 });
    const firstPath = group.presentation;
    feedback.showCombatTexts([...events]);
    const groups = feedback.store.getState().reactionAnnouncements;
    expect(groups[0]!.presentation).toBe(firstPath);
    expect(groups[1]!.presentation!.launchAt - Date.now()).toBe(320);
    expect(groups[1]!.presentation!.spread).not.toBe(firstPath!.spread);
    feedback.reset();
  });

  it("retains every emission, caps lag at 180 ms, and never evicts an active flight", () => {
    const feedback = makeFeedback();
    feedback.showCombatTexts([...hit]);
    const active = feedback.store.getState().floatingCombatBursts[0]!.entries[0]!.presentation;
    for (let i = 0; i < 40; i++) feedback.showCombatTexts([{ ...hit[0], additive: false }]);
    const entries = feedback.store.getState().floatingCombatBursts.flatMap((burst) => burst.entries);
    expect(entries).toHaveLength(41);
    expect(entries.filter((entry) => entry.presentation!.phase === "waiting")).toHaveLength(40);
    expect(entries[0]!.presentation).toBe(active);
    expect(Math.max(...entries.map((entry) => entry.presentation!.launchAt)) - Date.now()).toBeLessThanOrEqual(
      COMBAT_TEXT_MOTION.maximumQueueDelayMs,
    );
    expect(entries.some((entry) => (entry.presentation!.spread ?? 0) < 0)).toBe(true);
    expect(entries.some((entry) => (entry.presentation!.spread ?? 0) > 0)).toBe(true);
    vi.advanceTimersByTime(COMBAT_TEXT_MOTION.maximumQueueDelayMs);
    expect(feedback.store.getState().floatingCombatBursts.flatMap((burst) => burst.entries)).toHaveLength(41);
    vi.advanceTimersByTime(COMBAT_TEXT_LIFETIME_MS - 1);
    expect(
      feedback.store
        .getState()
        .floatingCombatBursts.flatMap((burst) => burst.entries)
        .map((entry) => entry.id),
    ).toContain(entries.at(-1)!.id);
    vi.advanceTimersByTime(1);
    expect(feedback.store.getState().floatingCombatBursts).toEqual([]);
    feedback.clearFloatingCombatTexts();
    vi.advanceTimersByTime(20000);
    expect(feedback.store.getState().floatingCombatBursts).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });
});

it("finishes a six-hit mixed burst within two seconds without retargeting launched text", () => {
  vi.useFakeTimers();
  const feedback = makeFeedback();
  const started = Date.now();
  try {
    for (let index = 0; index < 6; index++) {
      const before = feedback.store.getState().floatingCombatBursts.flatMap((burst) => burst.entries);
      const active = before.filter((entry) => entry.presentation!.phase === "visible");
      const oldIDs = new Set(before.map((entry) => entry.id));
      feedback.showCombatTexts([
        { ...hit[0], stat: index % 2 ? "burn" : "physical", additive: false },
        { target: "enemy", kind: "heal", stat: "health", amount: 4, additive: false },
        { target: "enemy", kind: "damage", stat: "block", amount: 3, additive: false },
      ]);
      const after = feedback.store.getState().floatingCombatBursts.flatMap((burst) => burst.entries);
      for (const old of active) expect(after.find((entry) => entry.id === old.id)?.presentation).toBe(old.presentation);
      for (const entry of after.filter((entry) => !oldIDs.has(entry.id))) {
        expect(entry.presentation!.launchAt - Date.now()).toBeLessThanOrEqual(180);
        expect(entry.presentation!.lifetimeMs).toBe(COMBAT_TEXT_LIFETIME_MS);
      }
      if (index < 5) vi.advanceTimersByTime(140);
    }
    const all = feedback.store.getState().floatingCombatBursts.flatMap((burst) => burst.entries);
    expect(all).toHaveLength(18);
    expect(
      Math.max(...all.map((entry) => entry.presentation!.launchAt + entry.presentation!.lifetimeMs)) - started,
    ).toBeLessThanOrEqual(2000);
    vi.advanceTimersByTime(2000 - (Date.now() - started));
    expect(feedback.store.getState().floatingCombatBursts).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    feedback.reset();
    vi.useRealTimers();
  }
});
