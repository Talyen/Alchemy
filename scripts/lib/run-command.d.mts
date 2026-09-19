export interface ScriptCommandResult {
  status: number | null;
  output: string;
  elapsedMs: number;
  error?: Error;
  outputTruncated?: boolean;
  timedOut?: boolean;
  logPath?: string;
}

export function runCommand(command: string, args?: string[], options?: Record<string, unknown>): ScriptCommandResult;

export function runStreamCommand(
  command: string,
  args?: string[],
  options?: { cwd?: string; env?: NodeJS.ProcessEnv },
): ScriptCommandResult & { elapsedMs: number };

export function runCommandAsync(
  command: string,
  args?: string[],
  options?: Record<string, unknown>,
): Promise<ScriptCommandResult>;
