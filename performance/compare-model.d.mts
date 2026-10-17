import type { FrameMetrics } from "./metrics";
import type { EnvironmentInfo, ScenarioAggregate } from "./report";

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

export interface ScenarioCompatibilityInput {
  scenario: string;
  profile?: string;
  caseIdentity?: string;
  segments?: Array<{ name: string; actions: number }>;
  runs?: Array<{ actions?: Array<{ name: string; segment: string }> }>;
}

export interface ScenarioComparisonResult {
  scenario: string;
  profile?: string;
  missing?: boolean;
  deltas: MetricDelta[];
  segmentDeltas?: Array<{ name: string; deltas: MetricDelta[] }>;
  notes: string[];
  rule: { ok: boolean; notes: string[] };
}

export interface ReportComparisonResult {
  beforeEnvironment: EnvironmentInfo;
  afterEnvironment: EnvironmentInfo;
  scenarios: ScenarioComparisonResult[];
}

export const COMPARE_KEYS: Array<{ key: MetricDelta["key"]; label: string; higherIsBetter: boolean }>;
export function checkEnvironmentCompatibility(
  beforeEnv?: Partial<EnvironmentInfo>,
  afterEnv?: Partial<EnvironmentInfo>,
): { compatible: boolean; errors: string[] };
export function assertEnvironmentCompatibility(
  beforeEnv?: Partial<EnvironmentInfo>,
  afterEnv?: Partial<EnvironmentInfo>,
): void;
export function checkScenarioCompatibility(
  beforeScenario: ScenarioCompatibilityInput,
  afterScenario: ScenarioCompatibilityInput,
): { compatible: boolean; errors: string[] };
export function assertScenarioCompatibility(
  beforeScenario: ScenarioCompatibilityInput,
  afterScenario: ScenarioCompatibilityInput,
): void;
export function deriveComparisonMetrics(metrics: FrameMetrics): FrameMetrics;
export function compareMetrics(beforeMetrics: FrameMetrics, afterMetrics: FrameMetrics): MetricDelta[];
export function meetsOptimizationRule(deltas: MetricDelta[]): { ok: boolean; notes: string[] };
export function compareReports(
  beforeReport: { environment: EnvironmentInfo; scenarios: ScenarioAggregate[] },
  afterReport: { environment: EnvironmentInfo; scenarios: ScenarioAggregate[] },
): ReportComparisonResult;
export function formatCompareNumber(n: number, digits?: number): string;
export function renderComparisonTable(deltas: MetricDelta[]): string[];
