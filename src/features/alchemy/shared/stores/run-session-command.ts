// Public command boundary for gameplay mutations.
//
// The underlying lifetime-matched stores are still being migrated, but feature
// code should enter the session through this module. Keeping the low-level
// transaction coordinator behind one command-shaped API gives us a stable seam
// for the eventual aggregate reducer without changing save/resume data today.
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
