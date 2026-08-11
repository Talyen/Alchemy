/** Pure frame-pacing metrics — no Playwright / DOM dependencies. */

export interface LongTaskSample {
  startTime: number;
  duration: number;
  phase: string;
}

/** rAF gap ≥50 ms correlated to the active perf-harness phase. */
export interface HitchEvent {
  timeMs: number;
  gapMs: number;
  phase: string;
}

export interface InputEventSample {
  name: string;
  startTime: number;
  duration: number;
  inputDelay: number;
  interactionId: number;
  phase: string;
}

export interface FrameSampleRaw {
  /** Consecutive rAF timestamp deltas in ms. */
  frameTimes: number[];
  longTasks: LongTaskSample[];
  /** Wall-clock duration of the measured window in ms. */
  durationMs: number;
  /** Phase marks: { time, phase } relative to sampler start. */
  phaseMarks: Array<{ time: number; phase: string }>;
  /** Worst frame gaps ≥50 ms with phase attribution. */
  hitchEvents?: HitchEvent[];
  inputEvents?: InputEventSample[];
}

export interface FrameMetrics {
  frameCount: number;
  durationMs: number;
  averageFps: number;
  p50FrameTime: number;
  p95FrameTime: number;
  p99FrameTime: number;
  p999FrameTime: number;
  onePercentLowFps: number;
  pointOnePercentLowFps: number;
  framesOver20ms: number;
  framesOver20msPct: number;
  framesOver33ms: number;
  framesOver33msPct: number;
  hitchesOver50ms: number;
  stallsOver100ms: number;
  longTasksOver50ms: number;
  maxFrameGapMs: number;
  worstFrameGaps: number[];
  longTasks: LongTaskSample[];
  hitchEvents: HitchEvent[];
  valid: boolean;
  invalidReason?: string;
}

export type TargetBand = "green" | "yellow" | "red";

export type TargetProfile = "continuous" | "transition";

export interface TargetCheck {
  id: string;
  label: string;
  actual: number;
  target: number;
  comparator: "<=" | ">=";
  band: TargetBand;
}

const MIN_FRAMES_DEFAULT = 100;
const HITCH_GAP_MS = 50;
const MAX_HITCH_EVENTS = 20;

export function phaseAtTime(phaseMarks: Array<{ time: number; phase: string }>, timeMs: number): string {
  let phase = phaseMarks[0]?.phase ?? "idle";
  for (const mark of phaseMarks) {
    if (mark.time <= timeMs) phase = mark.phase;
    else break;
  }
  return phase;
}

/** Correlate rAF gaps to harness phases for hitch localization. */
export function extractHitchEvents(
  frameTimes: number[],
  phaseMarks: Array<{ time: number; phase: string }>,
  minGapMs = HITCH_GAP_MS,
): HitchEvent[] {
  const hitches: HitchEvent[] = [];
  let timeMs = 0;
  for (const gapMs of frameTimes) {
    timeMs += gapMs;
    if (gapMs >= minGapMs) {
      hitches.push({ timeMs, gapMs, phase: phaseAtTime(phaseMarks, timeMs) });
    }
  }
  return hitches.sort((a, b) => b.gapMs - a.gapMs).slice(0, MAX_HITCH_EVENTS);
}

export function percentile(sortedAscending: number[], p: number): number {
  if (sortedAscending.length === 0) return 0;
  if (sortedAscending.length === 1) return sortedAscending[0]!;
  const clamped = Math.min(100, Math.max(0, p));
  const index = (clamped / 100) * (sortedAscending.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedAscending[lower]!;
  const weight = index - lower;
  return sortedAscending[lower]! * (1 - weight) + sortedAscending[upper]! * weight;
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** 1% low FPS = 1000 / mean(slowest 1% of frame times). */
export function lowFps(frameTimesAscending: number[], percent: number): number {
  if (frameTimesAscending.length === 0) return 0;
  const count = Math.max(1, Math.ceil(frameTimesAscending.length * (percent / 100)));
  const slowest = frameTimesAscending.slice(-count);
  const avg = mean(slowest);
  return avg > 0 ? 1000 / avg : 0;
}

export function computeMetrics(sample: FrameSampleRaw, options: { minFrames?: number } = {}): FrameMetrics {
  const minFrames = options.minFrames ?? MIN_FRAMES_DEFAULT;
  const frameTimes = sample.frameTimes.filter((t) => Number.isFinite(t) && t > 0);
  const sorted = [...frameTimes].sort((a, b) => a - b);
  const longTasks = sample.longTasks.filter((t) => t.duration >= 50);
  const hitchEvents = sample.hitchEvents ?? extractHitchEvents(frameTimes, sample.phaseMarks, HITCH_GAP_MS);

  if (frameTimes.length === 0) {
    return emptyMetrics(sample.durationMs, "no frame samples");
  }
  if (frameTimes.length < minFrames) {
    return {
      ...buildMetrics(sorted, frameTimes, longTasks, hitchEvents, sample.durationMs),
      valid: false,
      invalidReason: `insufficient frames (${frameTimes.length} < ${minFrames})`,
    };
  }

  return {
    ...buildMetrics(sorted, frameTimes, longTasks, hitchEvents, sample.durationMs),
    valid: true,
  };
}

function emptyMetrics(durationMs: number, reason: string): FrameMetrics {
  return {
    frameCount: 0,
    durationMs,
    averageFps: 0,
    p50FrameTime: 0,
    p95FrameTime: 0,
    p99FrameTime: 0,
    p999FrameTime: 0,
    onePercentLowFps: 0,
    pointOnePercentLowFps: 0,
    framesOver20ms: 0,
    framesOver20msPct: 0,
    framesOver33ms: 0,
    framesOver33msPct: 0,
    hitchesOver50ms: 0,
    stallsOver100ms: 0,
    longTasksOver50ms: 0,
    maxFrameGapMs: 0,
    worstFrameGaps: [],
    longTasks: [],
    hitchEvents: [],
    valid: false,
    invalidReason: reason,
  };
}

function buildMetrics(
  sorted: number[],
  frameTimes: number[],
  longTasks: LongTaskSample[],
  hitchEvents: HitchEvent[],
  durationMs: number,
): Omit<FrameMetrics, "valid" | "invalidReason"> {
  const framesOver20ms = frameTimes.filter((t) => t > 20).length;
  const framesOver33ms = frameTimes.filter((t) => t > 33.3).length;
  const hitchesOver50ms = frameTimes.filter((t) => t >= 50).length;
  const stallsOver100ms = frameTimes.filter((t) => t >= 100).length;
  const worstFrameGaps = [...sorted].reverse().slice(0, 10);
  const measuredDuration = durationMs > 0 ? durationMs : mean(frameTimes) * frameTimes.length;

  return {
    frameCount: frameTimes.length,
    durationMs: measuredDuration,
    averageFps: measuredDuration > 0 ? (frameTimes.length / measuredDuration) * 1000 : 0,
    p50FrameTime: percentile(sorted, 50),
    p95FrameTime: percentile(sorted, 95),
    p99FrameTime: percentile(sorted, 99),
    p999FrameTime: percentile(sorted, 99.9),
    onePercentLowFps: lowFps(sorted, 1),
    pointOnePercentLowFps: lowFps(sorted, 0.1),
    framesOver20ms,
    framesOver20msPct: (framesOver20ms / frameTimes.length) * 100,
    framesOver33ms,
    framesOver33msPct: (framesOver33ms / frameTimes.length) * 100,
    hitchesOver50ms,
    stallsOver100ms,
    longTasksOver50ms: longTasks.length,
    maxFrameGapMs: sorted[sorted.length - 1] ?? 0,
    worstFrameGaps,
    longTasks,
    hitchEvents,
  };
}

export function aggregateMetrics(runs: FrameMetrics[]): FrameMetrics {
  const validRuns = runs.filter((r) => r.valid);
  if (validRuns.length === 0) {
    return emptyMetrics(0, "no valid runs to aggregate");
  }

  // Pooling raw frame times is preferred via aggregateRawSamples; this path
  // averages scalar metrics when only per-run summaries are available.
  const durationMs = mean(validRuns.map((r) => r.durationMs));
  const frameCount = validRuns.reduce((sum, r) => sum + r.frameCount, 0);
  const longTasks = validRuns.flatMap((r) => r.longTasks);
  const worstGaps = validRuns
    .flatMap((r) => r.worstFrameGaps)
    .sort((a, b) => b - a)
    .slice(0, 10);

  return {
    frameCount,
    durationMs,
    averageFps: mean(validRuns.map((r) => r.averageFps)),
    p50FrameTime: mean(validRuns.map((r) => r.p50FrameTime)),
    p95FrameTime: mean(validRuns.map((r) => r.p95FrameTime)),
    p99FrameTime: mean(validRuns.map((r) => r.p99FrameTime)),
    p999FrameTime: mean(validRuns.map((r) => r.p999FrameTime)),
    onePercentLowFps: mean(validRuns.map((r) => r.onePercentLowFps)),
    pointOnePercentLowFps: mean(validRuns.map((r) => r.pointOnePercentLowFps)),
    framesOver20ms: validRuns.reduce((sum, r) => sum + r.framesOver20ms, 0),
    framesOver20msPct: mean(validRuns.map((r) => r.framesOver20msPct)),
    framesOver33ms: validRuns.reduce((sum, r) => sum + r.framesOver33ms, 0),
    framesOver33msPct: mean(validRuns.map((r) => r.framesOver33msPct)),
    hitchesOver50ms: validRuns.reduce((sum, r) => sum + r.hitchesOver50ms, 0),
    stallsOver100ms: validRuns.reduce((sum, r) => sum + r.stallsOver100ms, 0),
    longTasksOver50ms: longTasks.length,
    maxFrameGapMs: Math.max(...validRuns.map((r) => r.maxFrameGapMs)),
    worstFrameGaps: worstGaps,
    longTasks,
    hitchEvents: validRuns
      .flatMap((r) => r.hitchEvents)
      .sort((a, b) => b.gapMs - a.gapMs)
      .slice(0, MAX_HITCH_EVENTS),
    valid: true,
  };
}

/** Aggregate by pooling raw samples (preferred when available). */
export function aggregateRawSamples(samples: FrameSampleRaw[], options: { minFrames?: number } = {}): FrameMetrics {
  if (samples.length === 0) {
    return emptyMetrics(0, "no samples");
  }

  // Offset each run's timestamps so hitch/phase attribution stays meaningful across the pool.
  let timeOffset = 0;
  const pooledFrameTimes: number[] = [];
  const pooledLongTasks: LongTaskSample[] = [];
  const pooledPhaseMarks: Array<{ time: number; phase: string }> = [];
  const pooledHitches: HitchEvent[] = [];

  for (const s of samples) {
    pooledFrameTimes.push(...s.frameTimes);
    for (const task of s.longTasks) {
      pooledLongTasks.push({ ...task, startTime: task.startTime + timeOffset });
    }
    for (const mark of s.phaseMarks) {
      pooledPhaseMarks.push({ time: mark.time + timeOffset, phase: mark.phase });
    }
    const hitches = s.hitchEvents ?? extractHitchEvents(s.frameTimes, s.phaseMarks, HITCH_GAP_MS);
    for (const hitch of hitches) {
      pooledHitches.push({ ...hitch, timeMs: hitch.timeMs + timeOffset });
    }
    timeOffset += s.durationMs;
  }

  const pooled: FrameSampleRaw = {
    frameTimes: pooledFrameTimes,
    longTasks: pooledLongTasks,
    durationMs: timeOffset,
    phaseMarks: pooledPhaseMarks,
    hitchEvents: pooledHitches.sort((a, b) => b.gapMs - a.gapMs).slice(0, MAX_HITCH_EVENTS),
  };
  const minFrames = (options.minFrames ?? MIN_FRAMES_DEFAULT) * Math.max(1, samples.length);
  return computeMetrics(pooled, { minFrames });
}

export function classifyContinuous(metrics: FrameMetrics): TargetCheck[] {
  const durationSec = Math.max(metrics.durationMs / 1000, 1);
  return [
    check("p95", "p95 frame time (ms)", metrics.p95FrameTime, 18, "<="),
    check("p99", "p99 frame time (ms)", metrics.p99FrameTime, 20, "<="),
    check("p999", "p99.9 frame time (ms)", metrics.p999FrameTime, 33.3, "<="),
    check("onePercentLow", "1% low FPS", metrics.onePercentLowFps, 50, ">="),
    check("pointOnePercentLow", "0.1% low FPS", metrics.pointOnePercentLowFps, 30, ">="),
    check("over20pct", "frames >20 ms (%)", metrics.framesOver20msPct, 2, "<="),
    check("over33pct", "frames >33.3 ms (%)", metrics.framesOver33msPct, 0.5, "<="),
    check("hitches50", "≥50 ms hitches", metrics.hitchesOver50ms, 0, "<="),
    check("stalls100", "≥100 ms stalls", metrics.stallsOver100ms, 0, "<="),
    check("longTasks", "≥50 ms long tasks", metrics.longTasksOver50ms, 0, "<="),
    // durationSec reserved for future per-second hitch budgets
    check("durationNote", "measured duration (s)", durationSec, 0, ">="),
  ].filter((c) => c.id !== "durationNote");
}

export function classifyTransition(metrics: FrameMetrics): TargetCheck[] {
  const durationSec = Math.max(metrics.durationMs / 1000, 1);
  const hitchBudget = Math.max(1, Math.ceil(durationSec / 30));
  return [
    check("p95", "p95 frame time (ms)", metrics.p95FrameTime, 20, "<="),
    check("p99", "p99 frame time (ms)", metrics.p99FrameTime, 25, "<="),
    check("p999", "p99.9 frame time (ms)", metrics.p999FrameTime, 50, "<="),
    check("onePercentLow", "1% low FPS", metrics.onePercentLowFps, 40, ">="),
    check("pointOnePercentLow", "0.1% low FPS", metrics.pointOnePercentLowFps, 20, ">="),
    check("over20pct", "frames >20 ms (%)", metrics.framesOver20msPct, 5, "<="),
    check("hitches50", "≥50 ms hitches", metrics.hitchesOver50ms, hitchBudget, "<="),
    check("stalls100", "≥100 ms stalls", metrics.stallsOver100ms, 0, "<="),
    check("longTasks", "≥50 ms long tasks", metrics.longTasksOver50ms, hitchBudget, "<="),
  ];
}

export function classifyTargets(metrics: FrameMetrics, profile: TargetProfile): TargetCheck[] {
  return profile === "continuous" ? classifyContinuous(metrics) : classifyTransition(metrics);
}

function check(id: string, label: string, actual: number, target: number, comparator: "<=" | ">="): TargetCheck {
  const pass = comparator === "<=" ? actual <= target : actual >= target;
  const yellowSlack = comparator === "<=" ? target * 1.25 : target * 0.85;
  let band: TargetBand = "green";
  if (!pass) {
    const yellow = comparator === "<=" ? actual <= yellowSlack : actual >= yellowSlack;
    band = yellow ? "yellow" : "red";
  }
  return { id, label, actual, target, comparator, band };
}
