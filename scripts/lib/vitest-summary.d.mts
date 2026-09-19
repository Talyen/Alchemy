export interface VitestFailure {
  file: string;
  title: string;
  message: string;
}

export interface VitestSummary {
  failed: boolean;
  runnerErrors: string[];
  numFailedTestSuites: number;
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  numPendingTests: number;
  failures: VitestFailure[];
}

export function summarizeVitestReport(report: unknown, options?: { maxFailures?: number }): VitestSummary;

export function formatVitestSummaryMarkdown(summary: VitestSummary): string;

export function summarizeVitestFile(reportPath: string): string;
