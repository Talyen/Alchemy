export interface Command {
  key: string;
  command: string;
  args: string[];
}

export function captureVerificationInputs(root: string, env?: Record<string, string>): string | null;

export function createVerificationCache(
  root: string,
  commands: Command[],
  options?: {
    env?: Record<string, string>;
    minimumDurationMs?: number;
    capture?: () => string | null;
    now?: () => number;
  },
): {
  read(command: Command): { runId: string } | null;
  finish(
    outcomes: Array<{ command: Command; passed: boolean; reused?: string; result?: { elapsedMs: number } }>,
    runId: string,
  ): boolean;
};
