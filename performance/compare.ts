import type { FrameMetrics } from "./metrics";
import type { EnvironmentInfo, ScenarioAggregate } from "./report";
import {
  checkEnvironmentCompatibility as jsCheckEnvironmentCompatibility,
  assertEnvironmentCompatibility as jsAssertEnvironmentCompatibility,
  checkScenarioCompatibility as jsCheckScenarioCompatibility,
  assertScenarioCompatibility as jsAssertScenarioCompatibility,
  deriveComparisonMetrics as jsDeriveComparisonMetrics,
  compareMetrics as jsCompareMetrics,
  meetsOptimizationRule as jsMeetsOptimizationRule,
  compareReports as jsCompareReports,
  COMPARE_KEYS as jsCompareKeys,
} from "./compare-model.mjs";

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

export const COMPARE_KEYS: Array<{
  key: MetricDelta["key"];
  label: string;
  higherIsBetter: boolean;
}> = jsCompareKeys;

export function checkEnvironmentCompatibility(
  beforeEnv?: Partial<EnvironmentInfo>,
  afterEnv?: Partial<EnvironmentInfo>,
): { compatible: boolean; errors: string[] } {
  return jsCheckEnvironmentCompatibility(beforeEnv, afterEnv);
}

export function assertEnvironmentCompatibility(
  beforeEnv?: Partial<EnvironmentInfo>,
  afterEnv?: Partial<EnvironmentInfo>,
): void {
  jsAssertEnvironmentCompatibility(beforeEnv, afterEnv);
}

export function checkScenarioCompatibility(
  beforeScenario: { scenario: string; profile?: string },
  afterScenario: { scenario: string; profile?: string },
): { compatible: boolean; errors: string[] } {
  return jsCheckScenarioCompatibility(beforeScenario, afterScenario);
}

export function assertScenarioCompatibility(
  beforeScenario: { scenario: string; profile?: string },
  afterScenario: { scenario: string; profile?: string },
): void {
  jsAssertScenarioCompatibility(beforeScenario, afterScenario);
}

export function deriveComparisonMetrics(metrics: FrameMetrics): FrameMetrics {
  return jsDeriveComparisonMetrics(metrics);
}

export function compareMetrics(before: FrameMetrics, after: FrameMetrics): MetricDelta[] {
  return jsCompareMetrics(before, after);
}

/** True when p99 (or hitch count) improved by ≥10%, or a hitch was eliminated. */
export function meetsOptimizationRule(deltas: MetricDelta[]): {
  ok: boolean;
  notes: string[];
} {
  return jsMeetsOptimizationRule(deltas);
}

export interface ScenarioComparisonResult {
  scenario: string;
  profile?: string;
  missing?: boolean;
  deltas: MetricDelta[];
  notes: string[];
  rule: { ok: boolean; notes: string[] };
}

export interface ReportComparisonResult {
  beforeEnvironment: EnvironmentInfo;
  afterEnvironment: EnvironmentInfo;
  scenarios: ScenarioComparisonResult[];
}

export function compareReports(
  beforeReport: { environment: EnvironmentInfo; scenarios: ScenarioAggregate[] },
  afterReport: { environment: EnvironmentInfo; scenarios: ScenarioAggregate[] },
): ReportComparisonResult {
  return jsCompareReports(beforeReport, afterReport);
}
