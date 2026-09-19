export interface PlaywrightFailure {
  file: string;
  line: number;
  title: string;
  message: string;
  status: string;
  digestPath: string | null;
}

export interface PlaywrightSummary {
  failed: boolean;
  runnerErrors: string[];
  total: number;
  expected: number;
  unexpected: number;
  flaky: number;
  skipped: number;
  failures: PlaywrightFailure[];
}

export function collectPlaywrightTests(report: unknown): {
  allTests: Array<Record<string, unknown>>;
  totalTests: number;
  passedTests: number;
  skippedTests: number;
  failedTests: Array<Record<string, unknown>>;
  flakyTests: Array<Record<string, unknown>>;
};

export function topSlowestTests(
  allTests: Array<Record<string, unknown>>,
  count?: number,
): Array<Record<string, unknown>>;

export function summarizePlaywrightReport(
  report: unknown,
  options?: { maxFailures?: number; rootDir?: string; runId?: string },
): PlaywrightSummary;

export function formatPlaywrightSummaryMarkdown(summary: PlaywrightSummary): string;

export function summarizePlaywrightFile(reportPath: string): string;
