// Shared helpers for Immer draft mutations over the gameplay aggregate.

/** Set a field on an Immer draft target from a direct value or an updater over the previous value. */
function setDraftField<T extends object, K extends keyof T>(
  draft: T,
  field: K,
  action: T[K] | ((prev: T[K]) => T[K]),
): void {
  draft[field] = typeof action === "function" ? (action as (prev: T[K]) => T[K])(draft[field]) : action;
}

/**
 * Create a draft field setter for a known target object.
 * Avoids re-implementing the same `setDraftField(getTarget(draft), field, action)` closure
 * in each write-port (run/session/profile).
 */
export function createDraftFieldSetter<T extends object, Draft>(
  getTarget: (draft: Draft) => T,
): <K extends keyof T>(field: K) => (draft: Draft, action: T[K] | ((prev: T[K]) => T[K])) => void {
  return (field) => (draft, action) => setDraftField(getTarget(draft), field, action);
}
