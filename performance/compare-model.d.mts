/* eslint-disable @typescript-eslint/no-explicit-any -- JS interop seam: typed facade is performance/compare.ts */
export interface MetricCatalogEntry<T = string> {
  key: T;
  label: string;
  higherIsBetter: boolean;
}

export const COMPARE_KEYS: Array<MetricCatalogEntry<any>>;

export function checkEnvironmentCompatibility(
  beforeEnv?: any,
  afterEnv?: any,
): { compatible: boolean; errors: string[] };

export function assertEnvironmentCompatibility(beforeEnv?: any, afterEnv?: any): void;

export function checkScenarioCompatibility(
  beforeScenario?: any,
  afterScenario?: any,
): { compatible: boolean; errors: string[] };

export function assertScenarioCompatibility(
  beforeScenario?: any,
  afterScenario?: any,
): void;

export function deriveComparisonMetrics<T>(metrics: T): T;

export function compareMetrics(beforeMetrics: any, afterMetrics: any): any[];

export function meetsOptimizationRule(deltas: any[]): {
  ok: boolean;
  notes: string[];
};

export function compareReports(beforeReport: any, afterReport: any): any;
