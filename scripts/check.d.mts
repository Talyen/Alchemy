export function captureSourceDigest(): { head: string; hash: string };

export function parseCheckArgs(argv: string[]): string[];

export function runCheck(
  argv?: string[],
  options?: {
    runner?: (
      label: string,
      command: string,
      args: string[],
      env: NodeJS.ProcessEnv,
    ) =>
      | number
      | { status: number | null; elapsedMs: number; output: string }
      | Promise<number | { status: number | null; elapsedMs: number; output: string }>;
    captureDigest?: () => { head: string; hash: string };
  },
): Promise<number>;
