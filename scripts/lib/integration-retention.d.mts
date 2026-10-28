export function pruneIntegratedRuns(
  root: string,
  options?: { now?: number; dryRun?: boolean },
): Array<{ path: string; bytes: number }>;
