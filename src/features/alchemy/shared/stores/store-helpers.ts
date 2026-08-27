// Shared helpers for Immer draft mutations over the gameplay aggregate.

/** Set a field on an Immer draft target from a direct value or an updater over the previous value. */
export function setDraftField<T extends object, K extends keyof T>(
  draft: T,
  field: K,
  action: T[K] | ((prev: T[K]) => T[K]),
): void {
  draft[field] = typeof action === "function" ? (action as (prev: T[K]) => T[K])(draft[field]) : action;
}
