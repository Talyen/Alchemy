import { describe, expect, it } from "vitest";
import {
  aggregateRawSamples,
  classifyTargets,
  computeMetrics,
  extractHitchEvents,
  phaseAtTime,
  lowFps,
  mean,
  percentile,
  type FrameSampleRaw,
} from "../../performance/metrics";
import { compareMetrics, meetsOptimizationRule } from "../../performance/compare";
import { renderSummaryMarkdown, type EnvironmentInfo, type ScenarioAggregate } from "../../performance/report";

function sample(frameTimes: number[], extras: Partial<FrameSampleRaw> = {}): FrameSampleRaw {
  return {
    frameTimes,
    longTasks: [],
    durationMs: frameTimes.reduce((a, b) => a + b, 0),
    phaseMarks: [],
    ...extras,
  };
}

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

describe("computeMetrics", () => {
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

  it("extracts hitch events with phase attribution", () => {
    const marks = [
      { time: 0, phase: "discard-hand" },
      { time: 200, phase: "enemy-resolve" },
    ];
    const frameTimes = [16, 16, 80, 16, 120, 16];
    const hitches = extractHitchEvents(frameTimes, marks);
    expect(hitches.length).toBe(2);
    expect(hitches[0]?.gapMs).toBe(120);
    expect(phaseAtTime(marks, 16 + 16 + 80)).toBe("discard-hand");
    const metrics = computeMetrics(sample(frameTimes, { phaseMarks: marks, hitchEvents: hitches }), { minFrames: 5 });
    expect(metrics.hitchEvents.length).toBe(2);
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

  it("offsets phase marks so hitch attribution stays per-run", () => {
    const a = sample([16, 60, 16], {
      durationMs: 100,
      phaseMarks: [
        { time: 0, phase: "run-a" },
        { time: 50, phase: "run-a-late" },
      ],
      hitchEvents: [{ timeMs: 32, gapMs: 60, phase: "run-a" }],
    });
    const b = sample([16, 80, 16], {
      durationMs: 120,
      phaseMarks: [{ time: 0, phase: "run-b" }],
      hitchEvents: [{ timeMs: 32, gapMs: 80, phase: "run-b" }],
    });
    const agg = aggregateRawSamples([a, b], { minFrames: 3 });
    const hitchB = agg.hitchEvents.find((h) => h.gapMs === 80);
    expect(hitchB?.phase).toBe("run-b");
    expect(hitchB?.timeMs).toBe(132);
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
    expect(hitch?.band).toBe("green"); // budget allows 1 per 30s
  });
});

describe("compareMetrics", () => {
  it("detects p99 improvement and regressions", () => {
    const beforeTimes = Array.from({ length: 200 }, () => 16);
    for (let i = 180; i < 200; i++) beforeTimes[i] = 40;
    const before = computeMetrics(sample(beforeTimes), { minFrames: 100 });
    const after = computeMetrics(sample(Array.from({ length: 200 }, () => 16)), { minFrames: 100 });
    const deltas = compareMetrics(before, after);
    const p99 = deltas.find((d) => d.key === "p99FrameTime");
    expect(p99?.improved).toBe(true);
    const rule = meetsOptimizationRule(deltas);
    expect(rule.notes.length).toBeGreaterThan(0);
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
          },
        ],
      },
    ];
    const md = renderSummaryMarkdown({ environment, aggregates });
    expect(md).toContain("# Performance profile");
    expect(md).toContain("battle-effects");
    expect(md).toContain("GREEN");
    expect(md).toContain("abc123");
  });
});
