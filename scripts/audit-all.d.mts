import type { ScriptCommandResult } from "./lib/run-command.mjs";
export function runAudits(
  argv?: string[],
  options?: {
    rootDir?: string;
    runner?: (command: string, args: string[], options: Record<string, unknown>) => Promise<ScriptCommandResult>;
  },
): Promise<number>;
