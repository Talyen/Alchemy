export function parsePruneArgs(argv: string[]): { days: number; dryRun: boolean };

export function pruneTransientArtifacts(options?: {
  days?: number;
  dryRun?: boolean;
  now?: number;
  rootDir?: string;
  transientDirs?: readonly string[];
}): { removed: Array<{ path: string; bytes: number }>; bytes: number };
