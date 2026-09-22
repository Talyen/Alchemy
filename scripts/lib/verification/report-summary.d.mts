export const MAX_SUMMARY_FAILURES: number;

export function firstSummaryLine(message: unknown): string;

export function formatSummaryMarkdown(options: {
  heading: string;
  totals: string[];
  runnerErrors?: string[];
  failures?: Array<Record<string, unknown>>;
  renderFailure: (failure: never) => string[];
  overflowCount?: number;
  emptyNote: string;
}): string;

export function readJsonReport(reportPath: string): { resolved: string; data: unknown } | null;

export function missingReportMarkdown(heading: string, reportPath: string): string;
