export type FieldUpdate<T> = T | ((previous: T) => T);

export function setField<T extends object, K extends keyof T>(target: T, field: K, action: FieldUpdate<T[K]>): void {
  target[field] = typeof action === "function" ? (action as (previous: T[K]) => T[K])(target[field]) : action;
}
