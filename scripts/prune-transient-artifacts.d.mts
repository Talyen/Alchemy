export function parsePruneArgs(argv: string[]): { days: number; dryRun: boolean };

export function pruneExpiredArtifacts(options?: {
  days?: number;
  dryRun?: boolean;
  now?: number;
  rootDir?: string;
  transientDirs?: readonly string[];
}): { removed: Array<{ path: string; bytes: number }>; bytes: number; skippedActive: boolean };

export function pruneTransientArtifacts(
  options?: Parameters<typeof pruneExpiredArtifacts>[0],
): Promise<ReturnType<typeof pruneExpiredArtifacts>>;
