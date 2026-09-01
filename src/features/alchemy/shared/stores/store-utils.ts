export function deepFreezeInDev<T>(value: T): T {
  if (!import.meta.env.DEV || value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  if (value instanceof Date || value instanceof RegExp) return value;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) {
    if (child !== null && typeof child === "object") deepFreezeInDev(child);
  }
  return value;
}
