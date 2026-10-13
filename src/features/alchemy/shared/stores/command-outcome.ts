/** Detached result data, including nested containers; execution capabilities stay in the command. */
export type SynchronousResult<T> = T extends PromiseLike<unknown> | ((...args: never[]) => unknown)
  ? never
  : T extends ReadonlyMap<infer Key, infer Value>
    ? ReadonlyMap<SynchronousResult<Key>, SynchronousResult<Value>>
    : T extends ReadonlySet<infer Value>
      ? ReadonlySet<SynchronousResult<Value>>
      : T extends Date | RegExp
        ? T
        : T extends object
          ? { [K in keyof T]: SynchronousResult<T[K]> }
          : T;

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

export function assertSynchronousResult(result: unknown): void {
  if (
    result !== null &&
    (typeof result === "object" || typeof result === "function") &&
    "then" in result &&
    typeof result.then === "function"
  ) {
    void Promise.resolve(result).catch(() => undefined);
    throw new Error(
      "dispatchGameplayCommand: commands must be synchronous; move asynchronous work outside the command",
    );
  }
}
