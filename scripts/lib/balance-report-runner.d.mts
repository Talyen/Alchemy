export interface BalanceReportFile {
  directory: string;
  name: string;
  contents: string;
}

export interface BalanceReportRunResult<T = unknown> {
  files: BalanceReportFile[];
  report: T;
}

export interface BalanceReportRunnerOptions<T = unknown> {
  rootDir: string;
  command: string;
  artifacts: string[];
  summary: (result: BalanceReportRunResult<T>) => string;
  run: (modules: Record<string, unknown>) => Promise<BalanceReportRunResult<T>> | BalanceReportRunResult<T>;
}

export function runWithBalanceServer<T = unknown>(options: BalanceReportRunnerOptions<T>): Promise<T>;
