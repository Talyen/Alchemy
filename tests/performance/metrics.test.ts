import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LABYRINTH_HEX } from "@/lib/content-systems/labyrinth/hex-grid";
import {
  aggregateRawSamples,
  classifyTargets,
  computeMetrics,
  extractHitchEvents,
  phaseAtTime,
  lowFps,
  mean,
  percentile,
  type FrameGapSample,
  type FrameSampleRaw,
} from "../../performance/metrics";
import {
  assertEnvironmentCompatibility,
  assertScenarioCompatibility,
  checkEnvironmentCompatibility,
  checkScenarioCompatibility,
  compareMetrics,
  compareReports,
  deriveComparisonMetrics,
  meetsOptimizationRule,
} from "../../performance/compare";
import { renderSummaryMarkdown, type EnvironmentInfo, type ScenarioAggregate } from "../../performance/report";
import performanceCatalog from "../../performance/catalog.json";
import { SCENARIO_IDS } from "../../performance/fixtures";
import {
  battleProgressState,
  requirePositiveFiniteObservation,
  talentCategoryButtonName,
} from "../../performance/scenario-contracts";
import { productionHexLabyrinthMapFixture } from "../fixtures/labyrinth-hex-map";

function sample(frameTimes: number[], extras: Partial<FrameSampleRaw> = {}): FrameSampleRaw {
  return {
    frameTimes,
    longTasks: [],
    durationMs: frameTimes.reduce((a, b) => a + b, 0),
    phaseMarks: [],
    ...extras,
  };
}

function gapSample(frameGaps: FrameGapSample[], extras: Partial<FrameSampleRaw> = {}): FrameSampleRaw {
  const frameTimes = frameGaps.map((g) => g.duration);
  return {
    frameGaps,
    frameTimes,
    longTasks: [],
    durationMs: frameTimes.reduce((a, b) => a + b, 0),
    phaseMarks: [],
    ...extras,
  };
}

describe("performance catalog", () => {
  it("matches the scenario files and comparison metric keys", () => {
    const scenarioFiles = readdirSync(path.resolve(__dirname, "../../performance/scenarios"))
      .filter((file) => file.endsWith(".perf.ts"))
      .map((file) => file.replace(/\.perf\.ts$/u, ""))
      .sort();
    const catalogScenarios = [...performanceCatalog.metricScenarios, ...performanceCatalog.diagnosticScenarios].sort();
    expect(catalogScenarios).toEqual(scenarioFiles);
    expect([...SCENARIO_IDS].sort()).toEqual(catalogScenarios);
    const baseline = computeMetrics(sample([16]), { minFrames: 1 });
    expect(compareMetrics(baseline, baseline).map(({ key }) => key)).toEqual(
      performanceCatalog.metrics.map(({ key }) => key),
    );
  });
});

describe("performance scenario contracts", () => {
  it("uses the talent overview button accessible name", () => {
    expect(talentCategoryButtonName("Physical")).toBe("Select Physical Talents");
  });

  it("treats battle completion as terminal while waiting for a stage mark", () => {
    expect(battleProgressState(true, 0, 0)).toBe("battle-over");
    expect(battleProgressState(false, 2, 1)).toBe("stage-ready");
    expect(battleProgressState(false, 1, 1)).toBe("pending");
  });

  it("requires startup observations to be finite and greater than zero", () => {
    expect(requirePositiveFiniteObservation("rendererStartupReadyMs", 12.5)).toBe(12.5);
    for (const value of [undefined, 0, Number.NaN, Number.POSITIVE_INFINITY, -1]) {
      expect(() => requirePositiveFiniteObservation("rendererStartupReadyMs", value)).toThrow(/rendererStartupReadyMs/);
    }
  });

  it("uses a production-sized multi-floor Labyrinth fixture", () => {
    const map = productionHexLabyrinthMapFixture();
    const playable = map.floors.filter((floor) => floor.depth > 0);
    expect(playable.length).toBeGreaterThanOrEqual(2);
    for (const floor of playable) {
      expect(floor.nodeIds.length).toBeGreaterThanOrEqual(LABYRINTH_HEX.minNodesPerFloor);
      expect(floor.nodeIds.length).toBeLessThanOrEqual(LABYRINTH_HEX.maxNodesPerFloor);
    }
  });
});

describe("percentile / lowFps", () => {
  it("computes linear percentiles", () => {
    const sorted = [10, 20, 30, 40, 50];
    expect(percentile(sorted, 50)).toBe(30);
    expect(percentile(sorted, 0)).toBe(10);
    expect(percentile(sorted, 100)).toBe(50);
  });

  it("handles empty and single-value inputs", () => {
    expect(percentile([], 50)).toBe(0);
    expect(percentile([12], 99)).toBe(12);
    expect(mean([])).toBe(0);
    expect(lowFps([], 1)).toBe(0);
  });

  it("defines 1% low as 1000 / mean(slowest 1%)", () => {
    const times = Array.from({ length: 100 }, () => 16);
    times[99] = 50;
    const sorted = [...times].sort((a, b) => a - b);
    expect(lowFps(sorted, 1)).toBeCloseTo(1000 / 50, 5);
  });
});

describe("computeMetrics & exact frame gap sampling", () => {
  it("marks empty samples invalid", () => {
    const metrics = computeMetrics(sample([]));
    expect(metrics.valid).toBe(false);
    expect(metrics.invalidReason).toMatch(/no frame/);
  });

  it("marks short samples invalid but still reports numbers", () => {
    const metrics = computeMetrics(sample([16, 16, 16]), { minFrames: 10 });
    expect(metrics.valid).toBe(false);
    expect(metrics.frameCount).toBe(3);
    expect(metrics.averageFps).toBeGreaterThan(0);
  });

  it("computes sampled-gap FPS without unsampled window edge distortion", () => {
    const frameGaps: FrameGapSample[] = Array.from({ length: 60 }, (_, i) => ({
      startTime: 500 + i * (1000 / 60),
      duration: 1000 / 60,
    }));
    const metrics = computeMetrics(gapSample(frameGaps, { durationMs: 2000 }), { minFrames: 60 });
    expect(metrics.valid).toBe(true);
    expect(metrics.averageFps).toBeCloseTo(60, 1);
    expect(metrics.durationMs).toBe(2000);
  });

  it("classifies hitches and long tasks", () => {
    const times = Array.from({ length: 120 }, () => 16);
    times[10] = 55;
    times[11] = 120;
    const metrics = computeMetrics(
      sample(times, {
        longTasks: [{ startTime: 100, duration: 60, phase: "play-card" }],
      }),
      { minFrames: 100 },
    );
    expect(metrics.valid).toBe(true);
    expect(metrics.hitchesOver50ms).toBe(2);
    expect(metrics.stallsOver100ms).toBe(1);
    expect(metrics.longTasksOver50ms).toBe(1);
    expect(metrics.maxFrameGapMs).toBe(120);
  });

  it("counts exact 50 ms gaps as hitches", () => {
    const times = Array.from({ length: 100 }, () => 16);
    times[10] = 50;
    const metrics = computeMetrics(sample(times), { minFrames: 100 });
    expect(metrics.hitchesOver50ms).toBe(1);
    expect(extractHitchEvents(times, []).some((h) => h.gapMs === 50)).toBe(true);
  });

  it("preserves initial frame offset and exact hitch timestamps", () => {
    const marks = [
      { time: 0, phase: "intro" },
      { time: 100, phase: "action" },
    ];
    const frameGaps: FrameGapSample[] = [
      { startTime: 30, duration: 16 },
      { startTime: 46, duration: 80 },
      { startTime: 126, duration: 100 },
    ];
    const hitches = extractHitchEvents(frameGaps, marks);
    expect(hitches).toHaveLength(2);
    expect(phaseAtTime(marks, 46)).toBe("intro");
    expect(phaseAtTime(marks, 126)).toBe("action");
    expect(hitches[0]?.timeMs).toBe(126);
    expect(hitches[0]?.phase).toBe("action");
    expect(hitches[1]?.timeMs).toBe(46);
    expect(hitches[1]?.phase).toBe("intro");
  });

  it("normalizes long tasks and input events phase from start time", () => {
    const marks = [
      { time: 0, phase: "idle" },
      { time: 500, phase: "card-burst" },
    ];
    const raw: FrameSampleRaw = {
      frameTimes: Array.from({ length: 100 }, () => 16),
      longTasks: [{ startTime: 200, duration: 80, phase: "card-burst" }],
      durationMs: 1600,
      phaseMarks: marks,
      inputEvents: [
        { name: "pointerdown", startTime: 600, duration: 25, inputDelay: 5, interactionId: 1, phase: "idle" },
      ],
    };
    const metrics = computeMetrics(raw);
    expect(metrics.longTasks[0]?.phase).toBe("idle");
  });
});

describe("aggregateRawSamples", () => {
  it("pools frame times across runs", () => {
    const a = sample(Array.from({ length: 100 }, () => 16));
    const b = sample(Array.from({ length: 100 }, () => 20));
    const agg = aggregateRawSamples([a, b], { minFrames: 100 });
    expect(agg.valid).toBe(true);
    expect(agg.frameCount).toBe(200);
    expect(agg.p50FrameTime).toBeGreaterThanOrEqual(16);
  });

  it("offsets phase marks, frame gaps, and hitches across pooled runs", () => {
    const a: FrameSampleRaw = {
      frameGaps: [
        { startTime: 10, duration: 16 },
        { startTime: 26, duration: 60 },
      ],
      durationMs: 100,
      phaseMarks: [{ time: 0, phase: "run-a" }],
      longTasks: [{ startTime: 26, duration: 55, phase: "run-a" }],
    };
    const b: FrameSampleRaw = {
      frameGaps: [
        { startTime: 15, duration: 16 },
        { startTime: 31, duration: 80 },
      ],
      durationMs: 120,
      phaseMarks: [{ time: 0, phase: "run-b" }],
      longTasks: [{ startTime: 31, duration: 75, phase: "run-b" }],
    };
    const agg = aggregateRawSamples([a, b], { minFrames: 4 });
    expect(agg.valid).toBe(true);
    const hitchB = agg.hitchEvents.find((h) => h.gapMs === 80);
    expect(hitchB?.phase).toBe("run-b");
    expect(hitchB?.timeMs).toBe(100 + 31);

    const taskB = agg.longTasks.find((t) => t.duration === 75);
    expect(taskB?.phase).toBe("run-b");
    expect(taskB?.startTime).toBe(100 + 31);
  });
});

describe("classifyTargets", () => {
  it("marks smooth continuous motion green", () => {
    const metrics = computeMetrics(sample(Array.from({ length: 400 }, () => 16)), { minFrames: 100 });
    const checks = classifyTargets(metrics, "continuous");
    expect(checks.every((c) => c.band === "green")).toBe(true);
  });

  it("flags transition hitches against budget", () => {
    const times = Array.from({ length: 200 }, () => 16);
    times[0] = 60;
    const metrics = computeMetrics(sample(times, { durationMs: 30_000 }), { minFrames: 100 });
    const checks = classifyTargets(metrics, "transition");
    const hitch = checks.find((c) => c.id === "hitches50");
    expect(hitch?.band).toBe("green");
  });
});

describe("compareMetrics & duration normalization", () => {
  it("normalizes hitch counts across unequal durations", () => {
    const beforeMetrics = computeMetrics(
      sample(
        Array.from({ length: 600 }, () => 16),
        { durationMs: 10_000 },
      ),
    );
    const afterMetrics = computeMetrics(
      sample(
        Array.from({ length: 1200 }, () => 16),
        { durationMs: 20_000 },
      ),
    );

    beforeMetrics.hitchesOver50ms = 1;
    afterMetrics.hitchesOver50ms = 2;

    const normBefore = deriveComparisonMetrics(beforeMetrics);
    const normAfter = deriveComparisonMetrics(afterMetrics);

    expect(normBefore.hitchesOver50ms).toBe(3);
    expect(normAfter.hitchesOver50ms).toBe(3);

    const deltas = compareMetrics(beforeMetrics, afterMetrics);
    const hitchDelta = deltas.find((d) => d.key === "hitchesOver50ms");
    expect(hitchDelta?.delta).toBe(0);
    expect(hitchDelta?.percentChange).toBe(0);
  });

  it("detects eliminated hitches as an optimization improvement", () => {
    const before = computeMetrics(
      sample(
        Array.from({ length: 200 }, () => 16),
        { durationMs: 10_000 },
      ),
    );
    const after = computeMetrics(
      sample(
        Array.from({ length: 200 }, () => 16),
        { durationMs: 10_000 },
      ),
    );
    before.hitchesOver50ms = 2;
    after.hitchesOver50ms = 0;

    const deltas = compareMetrics(before, after);
    const rule = meetsOptimizationRule(deltas);
    expect(rule.ok).toBe(true);
    expect(rule.notes).toContain("eliminated all ≥50 ms hitches");
  });

  it("detects p99 improvement and rejects p95/p99 regressions", () => {
    const before = computeMetrics(sample(Array.from({ length: 200 }, () => 16)));
    const after = computeMetrics(sample(Array.from({ length: 200 }, () => 16)));
    before.p99FrameTime = 30;
    after.p99FrameTime = 20;

    const deltas = compareMetrics(before, after);
    const rule = meetsOptimizationRule(deltas);
    expect(rule.ok).toBe(true);
    expect(rule.notes.some((n) => n.includes("p99 improved"))).toBe(true);

    after.p95FrameTime = 25;
    before.p95FrameTime = 20;
    const regressedDeltas = compareMetrics(before, after);
    const rejectedRule = meetsOptimizationRule(regressedDeltas);
    expect(rejectedRule.ok).toBe(false);
    expect(rejectedRule.notes.some((n) => n.includes("p95 frame time (ms) regressed"))).toBe(true);
  });
});

describe("environment and scenario compatibility", () => {
  const baseEnv: EnvironmentInfo = {
    timestamp: "2026-01-01T00:00:00.000Z",
    platform: "darwin",
    arch: "arm64",
    node: "v24",
    runtime: "chromium",
    viewport: { width: 1440, height: 900 },
    devicePixelRatio: 2,
    estimatedRefreshHz: 60,
    commit: "abc1234",
    dirtyTree: false,
    branch: "main",
    traceMode: false,
    runsPerScenario: 1,
    coldMode: false,
    scenarios: ["battle-effects"],
  };

  it("passes for matching environments", () => {
    const res = checkEnvironmentCompatibility(baseEnv, { ...baseEnv, commit: "xyz5678" });
    expect(res.compatible).toBe(true);
    expect(() => assertEnvironmentCompatibility(baseEnv, baseEnv)).not.toThrow();
  });

  it("fails clearly when runtime, mode, or display conditions differ", () => {
    expect(checkEnvironmentCompatibility(baseEnv, { ...baseEnv, runtime: "electron" }).compatible).toBe(false);
    expect(checkEnvironmentCompatibility(baseEnv, { ...baseEnv, traceMode: true }).compatible).toBe(false);
    expect(checkEnvironmentCompatibility(baseEnv, { ...baseEnv, coldMode: true }).compatible).toBe(false);
    expect(checkEnvironmentCompatibility(baseEnv, { ...baseEnv, platform: "linux" }).compatible).toBe(false);
    expect(
      checkEnvironmentCompatibility(baseEnv, { ...baseEnv, viewport: { width: 1920, height: 1080 } }).compatible,
    ).toBe(false);
    expect(checkEnvironmentCompatibility(baseEnv, { ...baseEnv, devicePixelRatio: 1 }).compatible).toBe(false);
    expect(checkEnvironmentCompatibility(baseEnv, { ...baseEnv, estimatedRefreshHz: 120 }).compatible).toBe(false);
  });

  it("rejects mismatched scenario target profiles", () => {
    const beforeScenario = { scenario: "battle-effects", profile: "continuous" };
    const afterScenario = { scenario: "battle-effects", profile: "transition" };
    expect(checkScenarioCompatibility(beforeScenario, afterScenario).compatible).toBe(false);
    expect(() => assertScenarioCompatibility(beforeScenario, afterScenario)).toThrow(/Incompatible target profile/);
  });

  it("runs full report comparison and handles missing scenarios", () => {
    const metrics = computeMetrics(sample(Array.from({ length: 120 }, () => 16)), { minFrames: 100 });
    const beforeReport = {
      environment: baseEnv,
      scenarios: [
        { scenario: "battle-effects", profile: "continuous" as const, aggregate: metrics, targets: [], runs: [] },
        { scenario: "battle-end-turn", profile: "transition" as const, aggregate: metrics, targets: [], runs: [] },
      ],
    };
    const afterReport = {
      environment: baseEnv,
      scenarios: [
        { scenario: "battle-effects", profile: "continuous" as const, aggregate: metrics, targets: [], runs: [] },
      ],
    };
    const comparison = compareReports(beforeReport, afterReport);
    expect(comparison.scenarios).toHaveLength(2);
    expect(comparison.scenarios[1]?.missing).toBe(true);
  });
});

describe("renderSummaryMarkdown", () => {
  it("renders environment and target table", () => {
    const metrics = computeMetrics(sample(Array.from({ length: 120 }, () => 16)), { minFrames: 100 });
    const environment: EnvironmentInfo = {
      timestamp: "2026-01-01T00:00:00.000Z",
      platform: "darwin",
      arch: "arm64",
      node: "v24",
      runtime: "chromium",
      viewport: { width: 1440, height: 900 },
      commit: "abc123",
      dirtyTree: false,
      branch: "main",
      traceMode: false,
      runsPerScenario: 5,
      coldMode: false,
      scenarios: ["battle-effects"],
    };
    const aggregates: ScenarioAggregate[] = [
      {
        scenario: "battle-effects",
        profile: "continuous",
        aggregate: metrics,
        targets: classifyTargets(metrics, "continuous"),
        runs: [
          {
            scenario: "battle-effects",
            runIndex: 1,
            measured: true,
            profile: "continuous",
            metrics,
            targets: classifyTargets(metrics, "continuous"),
            observations: { rendererStartupReadyMs: 2400 },
            rawSamplePath: "/reports/battle-effects-1-sample.json",
            traceInsight: {
              status: "available",
              slowFrames: [
                {
                  timeMs: 10,
                  gapMs: 80,
                  phases: ["play-card", "damage-feedback"],
                  work: [{ name: "Layout", category: "style/layout", source: "app.js", selfMs: 60 }],
                  unaccountedMs: 20,
                },
              ],
            },
          },
        ],
      },
    ];
    const md = renderSummaryMarkdown({ environment, aggregates });
    expect(md).toContain("# Performance profile");
    expect(md).toContain("battle-effects");
    expect(md).toContain("GREEN");
    expect(md).toContain("abc123");
    expect(md).toContain("rendererStartupReadyMs");
    expect(md).toContain("[sample](/reports/battle-effects-1-sample.json)");
    expect(md).toContain("Slow-frame evidence — run 1");
    expect(md).toContain("play-card → damage-feedback");
    expect(md).toContain("Layout (style/layout): 60.0 ms — app.js");
  });
});
