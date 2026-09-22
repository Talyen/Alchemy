import type { VerificationCommand } from "./verification/change-routes.mjs";
export const ROUTINE_EXPOSURE_BUDGET_BYTES: number;

export function sanitizeOutput(output: string): string;

export function outputStats(output: string): { bytes: number; lines: number };

export function commandExposure(options: {
  key: string;
  label: string;
  command: string;
  result: { output: string; status: number | null; elapsedMs: number };
  exposedOutput?: string;
  budgetBytes?: number | null;
}): {
  key: string;
  label: string;
  command: string;
  status: number | null;
  durationMs: number;
  rawBytes: number;
  rawLines: number;
  exposedBytes: number;
  exposedLines: number;
  omittedBytes: number;
  omittedPercent: number;
  budgetBytes: number | null;
  overBudget: boolean;
};

export function firstOutputLine(output: string): string;

export function tailOutput(output: string, maxBytes?: number): string;

export function failureSummary(output: string, maxBytes?: number): string;

export function writeFailureDigest(
  directory: string,
  command: VerificationCommand,
  result: { output: string; status: number | null; elapsedMs: number },
  runId: string,
  index: number,
): { digestPath: string; logPath: string };
