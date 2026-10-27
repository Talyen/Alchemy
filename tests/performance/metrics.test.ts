import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  aggregateRawSamples,
  classifyTargets,
  computeMetrics,
  extractHitchEvents,
  phaseAtTime,
  type FrameGapSample,
  type FrameSampleRaw,
} from "../../performance/metrics";
import { compareMetrics, deriveComparisonMetrics, meetsOptimizationRule } from "../../performance/compare-model.mjs";
import { renderSummaryMarkdown, type EnvironmentInfo, type ScenarioAggregate } from "../../performance/report";
import performanceCatalog from "../../performance/catalog.json";
import { SCENARIO_IDS } from "../../performance/fixtures";
import { REALISTIC_SCENARIOS } from "../../performance/case-selection.mjs";
import { battleProgressState, requirePositiveFiniteObservation } from "../../performance/scenario-contracts";

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

it("performance catalog matches the scenario files and comparison metric keys", () => {
  const scenarioFiles = readdirSync(path.resolve(__dirname, "../../performance/scenarios"))
    .filter((file) => file.endsWith(".perf.ts"))
    .map((file) => file.replace(/\.perf\.ts$/u, ""))
    .sort();
  const catalogScenarios = [
    ...performanceCatalog.metricScenarios,
    ...performanceCatalog.syntheticScenarios,
    ...performanceCatalog.extremeScenarios,
    ...performanceCatalog.seededScenarios,
    ...performanceCatalog.diagnosticScenarios,
  ].sort();
  expect(
    [
      ...catalogScenarios.filter((id) => !REALISTIC_SCENARIOS.includes(id) && id !== "seeded-discovery"),
      "realistic-journeys",
    ].sort(),
  ).toEqual(scenarioFiles);
  expect([...SCENARIO_IDS].sort()).toEqual(catalogScenarios);
  const baseline = computeMetrics(sample([16]), { minFrames: 1 });
  expect(compareMetrics(baseline, baseline).map(({ key }) => key)).toEqual(
    performanceCatalog.metrics.map(({ key }) => key),
  );
});

describe("performance scenario contracts", () => {
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
});

it("reports low FPS from the slowest tail rather than a percentile reciprocal", () => {
  const metrics = computeMetrics(sample([...Array.from({ length: 198 }, () => 16), 40, 60]));
  expect(metrics.onePercentLowFps).toBe(20);
  expect(metrics.pointOnePercentLowFps).toBeCloseTo(1000 / 60);
});

describe("computeMetrics & exact frame gap sampling", () => {
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

  it("normalizes long-task phases from their start time", () => {
    const marks = [
      { time: 0, phase: "idle" },
      { time: 500, phase: "card-burst" },
    ];
    const raw: FrameSampleRaw = {
      frameTimes: Array.from({ length: 100 }, () => 16),
      longTasks: [{ startTime: 200, duration: 80, phase: "card-burst" }],
      durationMs: 1600,
      phaseMarks: marks,
    };
    const metrics = computeMetrics(raw);
    expect(metrics.longTasks[0]?.phase).toBe("idle");
  });
});

describe("aggregateRawSamples", () => {
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
    const agg = aggregateRawSamples([a, b], { minFrames: 2 });
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

it("renderSummaryMarkdown renders environment and target table", () => {
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
          observations: { rendererStartupReadyMs: 2400, fixtureHandCards: 7 },
          rawSamplePath: "/reports/battle-effects-1-sample.json",
          memorySamples: [
            {
              elapsedMs: 0,
              runtime: {
                domNodes: 100,
                images: 2,
                canvases: 0,
                audioElements: 0,
                jsHeapUsedBytes: 10 * 1_048_576,
                electronWorkingSetKB: 100 * 1024,
              },
            },
            {
              elapsedMs: 1000,
              runtime: {
                domNodes: 100,
                images: 2,
                canvases: 0,
                audioElements: 0,
                jsHeapUsedBytes: 30 * 1_048_576,
                electronWorkingSetKB: 200 * 1024,
              },
            },
            {
              elapsedMs: 2000,
              runtime: {
                domNodes: 100,
                images: 2,
                canvases: 0,
                audioElements: 0,
                jsHeapUsedBytes: 12 * 1_048_576,
                electronWorkingSetKB: 110 * 1024,
              },
            },
          ],
          longAnimationFrameSupported: true,
          longAnimationFrames: [
            {
              startTime: 12,
              duration: 80,
              blockingDuration: 20,
              renderTailMs: 35,
              styleAndLayoutTailMs: 12,
              phase: "play-card",
              scripts: [
                {
                  duration: 28,
                  forcedStyleAndLayoutDuration: 4,
                  sourceURL: "app.js",
                  sourceFunctionName: "renderCard",
                  invoker: "requestAnimationFrame",
                },
              ],
            },
          ],
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
  expect(md).not.toContain("Incomplete scenario coverage");
  const incomplete = renderSummaryMarkdown({
    environment: { ...environment, scenarios: ["battle-effects", "failed-warmup"] },
    aggregates,
  });
  expect(incomplete).toContain("Incomplete scenario coverage");
  expect(incomplete).toContain("failed-warmup: no measured result");
  expect(incomplete).toContain("cannot establish a performance improvement");
  const failed = renderSummaryMarkdown({
    environment,
    aggregates: aggregates.map((aggregate) => ({
      ...aggregate,
      runs: aggregate.runs.map((run) => ({ ...run, notes: ["Replay action path diverged"] })),
    })),
  });
  expect(failed).toContain("Failed measured runs");
  expect(failed).toContain("These runs failed and cannot establish a performance improvement");
  expect(failed).toContain("| 1 | no: Replay action path diverged |");
  const failedSegment = renderSummaryMarkdown({
    environment,
    aggregates: aggregates.map((aggregate) => ({
      ...aggregate,
      runs: aggregate.runs.map((run) => ({
        ...run,
        segments: [
          {
            name: "crafting",
            actions: 2,
            inputEvents: 0,
            maxInputDelayMs: 0,
            longAnimationFrames: 0,
            metrics,
            valid: false,
            invalidReason: "insufficient frames (15 < 20)",
          },
        ],
      })),
    })),
  });
  expect(failedSegment).toContain("Failed measured runs");
  expect(failedSegment).toContain("| 1 | no: crafting: insufficient frames (15 < 20) |");
  expect(md).toContain("| 1 | yes |");
  expect(md).toContain("# Performance profile");
  expect(md).toContain("battle-effects");
  expect(md).toContain("GREEN");
  expect(md).toContain("abc123");
  expect(md).toContain("rendererStartupReadyMs");
  expect(md).toContain("| rendererStartupReadyMs | 2400.0 ms | 2400.0 ms | 2400.0 ms |");
  expect(md).toContain("| fixtureHandCards | 7.0 | 7.0 | 7.0 |");
  expect(md).toContain("[sample](/reports/battle-effects-1-sample.json)");
  expect(md).toContain("| Renderer JS heap | 10.0 | 30.0 | 12.0 | 2.0 |");
  expect(md).toContain("| Combined Electron working set | 100.0 | 200.0 | 110.0 | 10.0 |");
  expect(md).toContain("Slow-frame evidence — run 1");
  expect(md).toContain("play-card → damage-feedback");
  expect(md).toContain("Layout (style/layout): 60.0 ms — app.js");
  expect(md).toContain("Long Animation Frames ≥50 ms: 1");
  expect(md).toContain("renderCard (28.0 ms; forced layout 4.0 ms) — app.js");
});
