import { expect, it } from "vitest";
import {
  aggregateRawSamples,
  classifyTargets,
  computeMetrics,
  extractHitchEvents,
  phaseAtTime,
} from "../../performance/metrics";
import {
  checkEnvironmentCompatibility,
  checkScenarioCompatibility,
  compareMetrics,
  compareReports,
  meetsOptimizationRule,
} from "../../performance/compare-model.mjs";
import type { EnvironmentInfo, ScenarioAggregate } from "../../performance/report";

const environment: EnvironmentInfo = {
  timestamp: "2026-01-01T00:00:00Z",
  platform: "darwin",
  arch: "arm64",
  node: "v24",
  runtime: "chromium",
  viewport: { width: 1920, height: 1080 },
  commit: "before",
  dirtyTree: false,
  branch: "main",
  traceMode: false,
  coldMode: false,
  runsPerScenario: 1,
  scenarios: ["battle-effects"],
};
const sample = (duration = 16, frames = 100) => ({
  frameTimes: Array.from({ length: frames }, () => duration),
  durationMs: duration * frames,
  longTasks: [],
  phaseMarks: [],
});
const metrics = () => computeMetrics(sample());
const scenario = (aggregate = metrics()): ScenarioAggregate => ({
  scenario: "battle-effects",
  profile: "continuous",
  aggregate,
  targets: [],
  runs: [],
});
const report = (scenarios = [scenario()]) => ({ environment, scenarios });

it("requires usable baseline metadata even when both reports omit the same fields", () => {
  expect(checkEnvironmentCompatibility({}, {}).compatible).toBe(false);
  for (const patch of [{ viewport: { width: 0, height: 1080 } }, { runsPerScenario: 0 }, { arch: "" }]) {
    const invalid = { ...environment, ...patch };
    expect(checkEnvironmentCompatibility(invalid, invalid).compatible, JSON.stringify(patch)).toBe(false);
  }
  expect(checkEnvironmentCompatibility(environment, { ...environment, commit: "after" }).compatible).toBe(true);
});

it("rejects architecture, run-count, and partially missing display evidence", () => {
  for (const patch of [
    { runtime: "electron" as const },
    { audioHost: "player" as const },
    { traceMode: true },
    { coldMode: true },
    { platform: "linux" },
    { viewport: { width: 1440, height: 900 } },
    { arch: "x64" },
    { runsPerScenario: 3 },
    { devicePixelRatio: 2 },
    { estimatedRefreshHz: 60 },
    { browser: "Chromium 145" },
  ]) {
    const other = { ...environment, ...patch };
    expect(checkEnvironmentCompatibility(environment, other).compatible, JSON.stringify(patch)).toBe(false);
    expect(checkEnvironmentCompatibility(other, environment).compatible, JSON.stringify(patch)).toBe(false);
  }
});

it("rejects invalid or incomplete measurements before they can appear to improve performance", () => {
  const incomplete = { ...report(), environment: { ...environment, scenarios: ["battle-effects", "failed-warmup"] } };
  expect(() => compareReports(incomplete, report())).toThrow(/Incomplete performance report.*failed-warmup/);
  expect(() => compareReports(report(), incomplete)).toThrow(/Incomplete performance report.*failed-warmup/);
  const failed = report([
    {
      ...scenario(),
      runs: [
        {
          scenario: "battle-effects",
          runIndex: 1,
          measured: true,
          profile: "continuous",
          metrics: metrics(),
          targets: [],
          notes: ["Replay action path diverged"],
        },
      ],
    },
  ]);
  expect(() => compareReports(report(), failed)).toThrow(/Failed measured run/);
  const before = metrics();
  for (const patch of [
    { valid: false },
    { durationMs: Infinity },
    { frameCount: 0 },
    { p99FrameTime: undefined },
    { hitchesOver50ms: -1 },
  ]) {
    expect(() => compareMetrics(before, { ...before, ...patch } as never), JSON.stringify(patch)).toThrow(
      /Invalid performance metrics/,
    );
  }
});

it("rejects an invalid journey segment even when its scenario aggregate passed", () => {
  const segment = {
    name: "combat",
    actions: 1,
    inputEvents: 0,
    maxInputDelayMs: 0,
    longAnimationFrames: 0,
    aggregate: { ...metrics(), valid: false },
  };
  expect(() => compareReports(report(), report([{ ...scenario(), segments: [segment] }]))).toThrow(
    /Invalid performance metrics/,
  );
  const run = {
    scenario: "battle-effects",
    runIndex: 1,
    measured: true,
    profile: "continuous" as const,
    metrics: metrics(),
    targets: [],
    segments: [{ ...segment, metrics: metrics(), valid: false }],
  };
  expect(() => compareReports(report(), report([{ ...scenario(), runs: [run] }]))).toThrow(/Invalid measured segment/);
});

it("rejects duplicate scenario names rather than selecting an arbitrary result", () => {
  for (const [before, after] of [
    [report(), report([scenario(), scenario()])],
    [report([scenario(), scenario()]), report()],
  ])
    expect(() => compareReports(before!, after!)).toThrow(/distinct performance scenarios/);
  expect(checkScenarioCompatibility(scenario(), { ...scenario(), scenario: "other" }).compatible).toBe(false);
});

it("does not let a zero-baseline frame-time regression qualify as an optimization", () => {
  const before = { ...metrics(), p95FrameTime: 0, p99FrameTime: 40 };
  const after = { ...before, p95FrameTime: 10, p99FrameTime: 20 };
  expect(meetsOptimizationRule(compareMetrics(before, after)).ok).toBe(false);
});

it("keeps each pooled run's sample requirement instead of hiding an empty run in a larger one", () => {
  expect(computeMetrics(sample(16, 1))).toMatchObject({ frameCount: 1, averageFps: 62.5, valid: false });
  const pooled = aggregateRawSamples([sample(16, 200), sample(16, 0)]);
  expect(pooled).toMatchObject({ frameCount: 200, valid: false, invalidReason: "run 2: no frame samples" });
  expect(aggregateRawSamples([sample(), sample()])).toMatchObject({ frameCount: 200, valid: true });
  expect(
    aggregateRawSamples(
      Array.from({ length: 6 }, () => sample(16, 50)),
      { minFrames: 50 },
    ),
  ).toMatchObject({
    frameCount: 300,
    valid: true,
  });
  expect(aggregateRawSamples([sample(16, 500), sample(16, 49)], { minFrames: 50 })).toMatchObject({
    valid: false,
    invalidReason: "run 2: insufficient frames (49 < 50)",
  });
});

it("resets phase attribution between runs and leaves time before the first mark idle", () => {
  expect(phaseAtTime([{ time: 100, phase: "combat" }], 50)).toBe("idle");
  const pooled = aggregateRawSamples(
    [
      { ...sample(60, 1), phaseMarks: [{ time: 0, phase: "combat" }] },
      {
        ...sample(80, 1),
        longTasks: [
          { startTime: 0, duration: 70, phase: "stale" },
          { startTime: -1, duration: 999, phase: "bad" },
        ],
        hitchEvents: [
          { timeMs: 0, gapMs: 80, phase: "stale" },
          { timeMs: -1, gapMs: 999, phase: "bad" },
        ],
      },
    ],
    { minFrames: 1 },
  );
  expect(pooled.hitchEvents).toEqual([
    { timeMs: 60, gapMs: 80, phase: "idle" },
    { timeMs: 0, gapMs: 60, phase: "combat" },
  ]);
  expect(pooled.longTasks).toEqual([{ startTime: 60, duration: 70, phase: "idle" }]);
});

it("uses exact frame gaps as the authority even when a legacy frame-time list remains", () => {
  expect(computeMetrics({ ...sample(), frameGaps: [] })).toMatchObject({ valid: false, frameCount: 0 });
});

it("marks broken measurement clocks invalid without poisoning later pooled timestamps", () => {
  const invalid = { ...sample(), durationMs: Infinity };
  expect(computeMetrics(invalid)).toMatchObject({ valid: false, invalidReason: "invalid measurement duration" });
  const pooled = aggregateRawSamples([invalid, sample()]);
  expect(pooled.valid).toBe(false);
  expect(Number.isFinite(pooled.durationMs)).toBe(true);
});

it("keeps missing or short evidence out of the green target bands", () => {
  for (const profile of ["continuous", "transition"] as const) {
    expect(classifyTargets(computeMetrics(sample(16, 0)), profile).every(({ band }) => band === "red")).toBe(true);
    expect(classifyTargets(computeMetrics(sample(16, 1)), profile).every(({ band }) => band === "red")).toBe(true);
    expect(classifyTargets(metrics(), profile).every(({ band }) => band === "green")).toBe(true);
  }
});

it("filters broken diagnostic timestamps and retains the worst bounded evidence", () => {
  const phaseMarks = [{ time: 0, phase: "combat" }];
  const hitches = Array.from({ length: 30 }, (_, i) => ({ timeMs: i, gapMs: 50 + i, phase: "stale" }));
  const result = computeMetrics({
    ...sample(),
    phaseMarks,
    hitchEvents: [...hitches, { timeMs: NaN, gapMs: 999, phase: "bad" }],
    longTasks: [
      { startTime: 0, duration: 60, phase: "stale" },
      { startTime: Infinity, duration: 999, phase: "bad" },
      { startTime: 10, duration: 90, phase: "stale" },
    ],
  });
  expect(result.hitchEvents).toHaveLength(20);
  expect(result.hitchEvents[0]).toEqual({ timeMs: 29, gapMs: 79, phase: "combat" });
  expect(result.longTasks).toEqual([
    { startTime: 10, duration: 90, phase: "combat" },
    { startTime: 0, duration: 60, phase: "combat" },
  ]);
  expect(extractHitchEvents([{ startTime: NaN, duration: 500 }], phaseMarks)).toEqual([]);
});

it("compares a complete report and keeps missing scenarios explicit", () => {
  const before = report([scenario(), { ...scenario(), scenario: "battle-end-turn", profile: "transition" }]);
  const comparison = compareReports(before, report());
  expect(comparison.scenarios[0]).toMatchObject({ scenario: "battle-effects", rule: { ok: false } });
  expect(comparison.scenarios[0]?.deltas.every(({ delta }) => delta === 0)).toBe(true);
  expect(comparison.scenarios[1]).toMatchObject({ scenario: "battle-end-turn", missing: true, rule: { ok: false } });
  expect(checkScenarioCompatibility(scenario(), { ...scenario(), profile: "transition" }).compatible).toBe(false);
});
