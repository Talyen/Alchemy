// Public command boundary for gameplay mutations.
//
// Feature code enters the authoritative gameplay aggregate through this module.
// Keeping transaction mechanics behind a command-shaped API preserves one
// synchronous commit boundary without coupling callers to Zustand or Immer.
import { runSessionTransaction } from "./run-session-transaction";

export interface RunSessionCommand<T> {
  execute: () => T;
  /** Non-rollbackable work such as audio, navigation, or presentation cleanup. */
  afterCommit?: (result: T) => void;
}

/** Execute one synchronous gameplay command and publish one committed revision. */
export function dispatchRunSessionCommand<T>(command: RunSessionCommand<T>): T;
export function dispatchRunSessionCommand<T>(execute: () => T, options?: Pick<RunSessionCommand<T>, "afterCommit">): T;
export function dispatchRunSessionCommand<T>(
  commandOrExecute: RunSessionCommand<T> | (() => T),
  options: Pick<RunSessionCommand<T>, "afterCommit"> = {},
): T {
  const command =
    typeof commandOrExecute === "function"
      ? { execute: commandOrExecute, afterCommit: options.afterCommit }
      : commandOrExecute;
  return command.afterCommit
    ? runSessionTransaction(command.execute, { afterCommit: command.afterCommit })
    : runSessionTransaction(command.execute);
}
