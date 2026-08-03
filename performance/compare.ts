import type { FrameMetrics } from "./metrics";

export interface MetricDelta {
  key: keyof Pick<
    FrameMetrics,
    | "averageFps"
    | "p50FrameTime"
    | "p95FrameTime"
    | "p99FrameTime"
    | "p999FrameTime"
    | "onePercentLowFps"
    | "pointOnePercentLowFps"
    | "framesOver20msPct"
    | "framesOver33msPct"
    | "hitchesOver50ms"
    | "stallsOver100ms"
    | "longTasksOver50ms"
    | "maxFrameGapMs"
  >;
  label: string;
  before: number;
  after: number;
  /** Positive means after is higher. */
  delta: number;
  /** Percent change relative to before; null when before is 0. */
  percentChange: number | null;
  /** lower-is-better for frame times / hitches; higher-is-better for FPS. */
  higherIsBetter: boolean;
  improved: boolean | null;
}

const COMPARE_KEYS: Array<{
  key: MetricDelta["key"];
  label: string;
  higherIsBetter: boolean;
}> = [
  { key: "averageFps", label: "Average FPS", higherIsBetter: true },
  { key: "p50FrameTime", label: "p50 frame time (ms)", higherIsBetter: false },
  { key: "p95FrameTime", label: "p95 frame time (ms)", higherIsBetter: false },
  { key: "p99FrameTime", label: "p99 frame time (ms)", higherIsBetter: false },
  { key: "p999FrameTime", label: "p99.9 frame time (ms)", higherIsBetter: false },
  { key: "onePercentLowFps", label: "1% low FPS", higherIsBetter: true },
  { key: "pointOnePercentLowFps", label: "0.1% low FPS", higherIsBetter: true },
  { key: "framesOver20msPct", label: "frames >20 ms (%)", higherIsBetter: false },
  { key: "framesOver33msPct", label: "frames >33.3 ms (%)", higherIsBetter: false },
  { key: "hitchesOver50ms", label: "≥50 ms hitches", higherIsBetter: false },
  { key: "stallsOver100ms", label: "≥100 ms stalls", higherIsBetter: false },
  { key: "longTasksOver50ms", label: "≥50 ms long tasks", higherIsBetter: false },
  { key: "maxFrameGapMs", label: "Max frame gap (ms)", higherIsBetter: false },
];

export function compareMetrics(before: FrameMetrics, after: FrameMetrics): MetricDelta[] {
  return COMPARE_KEYS.map(({ key, label, higherIsBetter }) => {
    const b = before[key];
    const a = after[key];
    const delta = a - b;
    const percentChange = b === 0 ? null : (delta / b) * 100;
    let improved: boolean | null = null;
    if (delta !== 0) {
      improved = higherIsBetter ? delta > 0 : delta < 0;
    }
    return { key, label, before: b, after: a, delta, percentChange, higherIsBetter, improved };
  });
}

/** True when p99 (or hitch count) improved by ≥10%, or a hitch was eliminated. */
export function meetsOptimizationRule(deltas: MetricDelta[]): {
  ok: boolean;
  notes: string[];
} {
  const notes: string[] = [];
  const p99 = deltas.find((d) => d.key === "p99FrameTime");
  const hitches = deltas.find((d) => d.key === "hitchesOver50ms");

  let improved = false;
  if (p99 && p99.percentChange !== null && p99.improved && Math.abs(p99.percentChange) >= 10) {
    improved = true;
    notes.push(`p99 improved by ${Math.abs(p99.percentChange).toFixed(1)}%`);
  }
  if (hitches && hitches.before > 0 && hitches.after === 0) {
    improved = true;
    notes.push("eliminated all ≥50 ms hitches");
  } else if (hitches && hitches.percentChange !== null && hitches.improved && Math.abs(hitches.percentChange) >= 10) {
    improved = true;
    notes.push(`hitches improved by ${Math.abs(hitches.percentChange).toFixed(1)}%`);
  }

  const regressions: string[] = [];
  for (const key of ["p95FrameTime", "p99FrameTime"] as const) {
    const d = deltas.find((x) => x.key === key);
    if (d && d.percentChange !== null && !d.improved && Math.abs(d.percentChange) > 5) {
      regressions.push(`${d.label} regressed by ${Math.abs(d.percentChange).toFixed(1)}%`);
    }
  }

  if (!improved && notes.length === 0) {
    notes.push("no ≥10% p99/hitch improvement detected");
  }

  return { ok: improved && regressions.length === 0, notes: [...notes, ...regressions] };
}
