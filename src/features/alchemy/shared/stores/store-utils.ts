export function deepFreezeInDev<T>(value: T, seen: WeakSet<object> = new WeakSet()): T {
  if (!import.meta.env.DEV || value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  if (value instanceof Date || value instanceof RegExp) return value;
  if (seen.has(value)) return value;
  seen.add(value);
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) {
    if (child !== null && typeof child === "object") deepFreezeInDev(child, seen);
  }
  return value;
}
