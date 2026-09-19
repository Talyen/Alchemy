import type { ContextMeasurement } from "./measure-agent-context.mjs";
export const ROUTINE_EXPOSURE_BUDGET_BYTES: number;

export interface CommandHotspot {
  key: string;
  label: string;
  occurrences: number;
  failures: number;
  rawBytes: number;
  exposedBytes: number;
  maxExposedBytes: number;
  overBudgetOccurrences: number;
  maxRawBytes: number;
  rawLines: number;
  avoidedPercent: number;
}

export function parseContextHotspotArgs(argv: string[]): {
  last: number;
  minBytes: number;
  json: boolean;
  check: boolean;
};

export function aggregateCommandExposures(runs: Array<Record<string, unknown>>, minBytes?: number): CommandHotspot[];

export function buildContextHotspotReport(
  rootDir: string,
  options?: { last?: number; minBytes?: number },
): {
  generatedAt: string;
  inspectedRuns: number;
  routes: ContextMeasurement[];
  discovery: Array<import("./measure-agent-context.mjs").DiscoveryMeasurement>;
  commands: CommandHotspot[];
};

export function formatContextHotspotReport(report: {
  generatedAt: string;
  inspectedRuns: number;
  routes: ContextMeasurement[];
  discovery: Array<import("./measure-agent-context.mjs").DiscoveryMeasurement>;
  commands: CommandHotspot[];
}): string;
