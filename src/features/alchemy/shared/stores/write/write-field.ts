import type { GameplayDraft } from "../run-session-command";

export type FieldUpdate<T> = T | ((previous: T) => T);

function setField<T extends object, K extends keyof T>(target: T, field: K, action: FieldUpdate<T[K]>): void {
  target[field] = typeof action === "function" ? (action as (previous: T[K]) => T[K])(target[field]) : action;
}

// Single generic behind every plain draft-field setter (session, reward flow,
// run progress, profile). Visit and mystery-visit setters keep bespoke
// factories in run-session.ts: they reshape the activity union rather than
// setting a field.
export function defineDraftSetter<Target extends object, K extends keyof Target>(
  select: (draft: GameplayDraft) => Target,
  field: K,
) {
  return (draft: GameplayDraft, action: FieldUpdate<Target[K]>): void => {
    setField(select(draft), field, action);
  };
}
