export function parseShowRunsArgs(argv: string[]): { last: number; status?: string };

export function readRecentRuns(
  rootDir: string,
  options?: { last?: number; status?: string },
): Array<Record<string, unknown>>;

export function formatRecentRun(rootDir: string, record: Record<string, unknown>): string;
