export function runCiLint(options?: {
  rootDir?: string;
  runner?: (
    command: string,
    args: string[],
    options: Record<string, unknown>,
  ) => Promise<{ status: number | null; elapsedMs: number; output: string; logPath?: string }>;
}): Promise<number>;
