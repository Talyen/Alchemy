export const INTEGRATION_RETENTION_POLICY: string;
export function pruneIntegratedRuns(
  root: string,
  options?: { now?: number; dryRun?: boolean },
): Array<{ path: string; bytes: number }>;
