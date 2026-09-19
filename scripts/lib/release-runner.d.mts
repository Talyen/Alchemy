export function parseReleaseArgs(argv: string[]): { dryRun: boolean; hotfix: boolean };

export function runRelease(options: {
  label: string;
  gates: string[][];
  bumpArgs?: string[];
  dryRun?: boolean;
}): Promise<void>;
