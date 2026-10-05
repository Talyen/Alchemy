export type SynchronousResult<T> = T extends PromiseLike<unknown> ? never : T;

export type CommandOutcome<T> = { kind: "accepted"; value: T } | { kind: "rejected"; reason: string; value: T };

export function acceptCommand(): CommandOutcome<void>;
export function acceptCommand<T>(value: T & SynchronousResult<T>): CommandOutcome<T> & { value: SynchronousResult<T> };
export function acceptCommand<T>(value?: T): CommandOutcome<T | undefined> {
  return { kind: "accepted", value };
}

/** The fallback preserves the caller's existing rejection result, such as false or null. */
export function rejectCommand<T>(
  reason: string,
  value: T & SynchronousResult<T>,
): CommandOutcome<T> & { value: SynchronousResult<T> } {
  return { kind: "rejected", reason, value };
}
