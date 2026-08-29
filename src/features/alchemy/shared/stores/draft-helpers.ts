function setDraftField<T extends object, K extends keyof T>(
  draft: T,
  field: K,
  action: T[K] | ((prev: T[K]) => T[K]),
): void {
  draft[field] = typeof action === "function" ? (action as (prev: T[K]) => T[K])(draft[field]) : action;
}

export function createDraftFieldSetter<T extends object, Draft>(
  getTarget: (draft: Draft) => T,
): <K extends keyof T>(field: K) => (draft: Draft, action: T[K] | ((prev: T[K]) => T[K])) => void {
  return (field) => (draft, action) => setDraftField(getTarget(draft), field, action);
}
