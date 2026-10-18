import { describe, expect, it } from "vitest";
import { chooseCheckpointStep, selectCase, selectDiscoverySeed } from "../../performance/case-selection.mjs";
import { checkScenarioCompatibility } from "../../performance/compare-model.mjs";
import { assertJourneyCase } from "../../performance/journey-types";
import { measureSegments } from "../../performance/journey-segments";
import { createCombatChoices } from "../../performance/combat-choices";
import { summarizeMeasuredCoverage } from "../../performance/journey-coverage";
import type { JourneyCase } from "../../performance/journey-types";
import type { FrameSampleRaw } from "../../performance/metrics";

describe("reachable performance cases", () => {
  it("rotates every hero through each nightly mode with fresh reproducible seeds and varied policies", () => {
    const seeds = new Set<number>();
    const policies = new Set<string>();
    const difficulties = new Set<string>();
    for (let slot = 0; slot < 3; slot++) {
      const heroes = new Set<string>();
      for (let cycle = 100; cycle < 108; cycle++) {
        const seed = selectDiscoverySeed(cycle, slot);
        expect(selectDiscoverySeed(cycle, slot)).toBe(seed);
        expect(seed).toBeGreaterThanOrEqual(0);
        expect(seed).toBeLessThanOrEqual(0xffffffff);
        const selected = selectCase("seeded-discovery", seed);
        expect(selected.mode).toBe(["campaign", "labyrinth", "wildwood"][slot]);
        heroes.add(selected.hero);
        policies.add(selected.policy);
        difficulties.add(selected.difficulty);
        seeds.add(seed);
      }
      expect(heroes.size).toBe(8);
    }
    expect(seeds.size).toBe(24);
    expect(policies.size).toBe(3);
    expect(difficulties.size).toBe(3);
    expect(() => selectDiscoverySeed(1, 3)).toThrow();
    expect(() => selectCase("seeded-discovery", -1)).toThrow(/uint32/);
  });

  it("samples reachable bosses and ordinary encounters across runs instead of always choosing the first developed battle", () => {
    const starts = [
      { stage: "start", step: 2, run: 0, room: 1, boss: false },
      { stage: "start", step: 40, run: 1, room: 7, boss: false },
      { stage: "start", step: 80, run: 1, room: 10, boss: true },
    ];
    const result = {
      telemetry: { battleSnapshots: [...starts, { ...starts[2]!, stage: "settle", step: 81 }] },
      journal: [],
    };
    const selectedSteps = new Set<number | undefined>();
    for (let seed = 0; seed < 32; seed++) {
      const spec = selectCase("seeded-discovery", seed);
      const selected = chooseCheckpointStep(spec, result);
      expect(chooseCheckpointStep(spec, result)).toBe(selected);
      selectedSteps.add(selected);
    }
    expect([...selectedSteps].sort((a, b) => a! - b!)).toEqual([2, 40, 80]);
    expect(
      chooseCheckpointStep(selectCase("seeded-discovery"), { telemetry: { battleSnapshots: [] }, journal: [] }),
    ).toBeUndefined();
    expect(
      chooseCheckpointStep(selectCase("seeded-discovery"), {
        telemetry: { battleSnapshots: [starts[0]!] },
        journal: [],
      }),
    ).toBe(2);
  });

  it("chooses recorded, reachable checkpoints rather than inventing combat state", () => {
    const result = {
      telemetry: {
        battleSnapshots: [
          { stage: "start", step: 2, run: 0, room: 1 },
          { stage: "start", step: 40, run: 1, room: 7 },
        ],
      },
      journal: [
        { step: 12, action: { kind: "reward" } },
        { step: 20, action: { kind: "buy-card" } },
      ],
    };
    expect(chooseCheckpointStep(selectCase("campaign-developed"), result)).toBe(40);
    expect(chooseCheckpointStep(selectCase("reward-route"), result)).toBe(12);
    expect(chooseCheckpointStep(selectCase("shop-journey"), result)).toBe(20);
  });

  it("validates replay case shape and rejects mismatched checkpoints or actions", () => {
    const journeyCase = {
      version: 1,
      scenario: "campaign-early",
      seed: 42,
      saveHash: "abc",
      initialSave: {},
      coverage: { cards: ["slash"] },
    };
    expect(() => assertJourneyCase(journeyCase)).not.toThrow();
    expect(() => assertJourneyCase({ ...journeyCase, coverage: {} })).toThrow();
    const before = {
      scenario: "campaign-early",
      profile: "continuous",
      caseIdentity: "abc",
      segments: [{ name: "combat", actions: 2 }],
      runs: [{ actions: [{ name: "play:Slash", segment: "combat" }] }],
    };
    expect(checkScenarioCompatibility(before, before).compatible).toBe(true);
    expect(checkScenarioCompatibility(before, { ...before, caseIdentity: "xyz" }).compatible).toBe(false);
    expect(
      checkScenarioCompatibility(before, { ...before, segments: [{ name: "combat", actions: 1 }] }).compatible,
    ).toBe(false);
    expect(
      checkScenarioCompatibility(before, { ...before, runs: [{ actions: [{ name: "end-turn", segment: "combat" }] }] })
        .compatible,
    ).toBe(false);
  });
});

it("journey segment measurement pools repeated visits to a segment without counting intervening idle frames", () => {
  const sample: FrameSampleRaw = {
    frameGaps: Array.from({ length: 30 }, (_, index) => ({
      startTime: index * 10,
      duration: index === 16 ? 60 : 10,
    })),
    frameTimes: [],
    longTasks: [{ startTime: 160, duration: 60, phase: "idle" }],
    durationMs: 300,
    phaseMarks: [
      { time: 0, phase: "combat" },
      { time: 100, phase: "idle" },
      { time: 200, phase: "combat" },
    ],
  };
  const actions = [{ name: "play", segment: "combat", timeMs: 50 }];
  const results = measureSegments(sample, actions, [
    { name: "combat", minActions: 1, minFrames: 20 },
    { name: "idle", minActions: 0, minFrames: 10 },
  ]);
  expect(results[0]).toMatchObject({ name: "combat", actions: 1, valid: true });
  expect(results[0]?.metrics.frameCount).toBe(20);
  expect(results[0]?.metrics.hitchesOver50ms).toBe(0);
  expect(results[1]?.metrics.hitchesOver50ms).toBe(1);
  expect(measureSegments(sample, [], [{ name: "combat", minActions: 1, minFrames: 20 }])[0]?.valid).toBe(false);
});

it("varies legal combat decisions, prefers unseen actions, and replays card and Wish choices in order", () => {
  const journeyCase: JourneyCase = {
    version: 1,
    ...selectCase("seeded-discovery", 123),
    checkpointStep: 2,
    saveHash: "abc",
    initialSave: {},
    coverage: { cards: [] },
  };
  const names = ["play:Slash", "play:Poison", "play:Heal"];
  const firstChoices = new Set<number>();
  for (let seed = 0; seed < 16; seed++) firstChoices.add(createCombatChoices({ ...journeyCase, seed }).choose(names));
  expect(firstChoices.size).toBe(3);
  const choices = createCombatChoices(journeyCase);
  const duplicate = createCombatChoices(journeyCase);
  const path = [choices.choose(names), choices.choose(names), choices.choose(names)];
  expect([duplicate.choose(names), duplicate.choose(names), duplicate.choose(names)]).toEqual(path);
  expect(new Set(path).size).toBe(3);
  const recordedActions = ["play:Poison", "wish:Choose Meteor", "play:Slash"].map((name) => ({
    name,
    segment: "combat",
    timeMs: 1,
  }));
  const replay = createCombatChoices({ ...journeyCase, recordedActions });
  expect(replay.choose(names)).toBe(1);
  expect(replay.choose(["wish:Choose Heal", "wish:Choose Meteor"])).toBe(1);
  expect(() => replay.finish()).toThrow(/before/);
  expect(replay.choose(names)).toBe(0);
  expect(() => replay.finish()).not.toThrow();
  expect(() => replay.choose(names)).toThrow(/no further actions/);
  const mismatch = createCombatChoices({ ...journeyCase, recordedActions });
  expect(() => mismatch.choose(["play:Slash"])).toThrow(/unavailable/);
  expect(() => mismatch.choose(["wish:Choose Meteor"])).toThrow(/unavailable/);
  expect(
    summarizeMeasuredCoverage([...recordedActions, { name: "end-turn", segment: "enemy-turn", timeMs: 2 }]),
  ).toEqual({
    playedCardLabels: ["Poison", "Slash"],
    wishChoiceLabels: ["Choose Meteor"],
    cardPlays: 2,
    endTurnActions: 1,
  });
});
