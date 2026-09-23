import { describe, expect, it } from "vitest";
import { chooseCheckpointStep, selectCase } from "../../performance/case-selection.mjs";
import { checkScenarioCompatibility } from "../../performance/compare";
import { assertJourneyCase } from "../../performance/journey-types";
import { measureSegments } from "../../performance/journey-segments";
import type { FrameSampleRaw } from "../../performance/metrics";

describe("reachable performance cases", () => {
  it("selects each mode reproducibly and rejects invalid seeds", () => {
    expect(selectCase("seeded-discovery", 0)).toMatchObject({ hero: "knight", mode: "campaign" });
    expect(selectCase("seeded-discovery", 9)).toMatchObject({ hero: "rogue", mode: "labyrinth" });
    expect(selectCase("seeded-discovery", 42)).toMatchObject({ hero: "wizard", mode: "wildwood" });
    expect(selectCase("seeded-discovery", 9)).toEqual(selectCase("seeded-discovery", 9));
    expect(() => selectCase("seeded-discovery", -1)).toThrow(/uint32/);
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
    expect(selectCase("trinket-journey")).toMatchObject({ seed: 1, policy: "random", checkpoint: "trinket-battle" });
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

describe("journey segment measurement", () => {
  it("pools repeated visits to a segment without counting intervening idle frames", () => {
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
});
