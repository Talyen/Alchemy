// Unconditional deep freeze for shared singletons that must never be mutated
// in any build (e.g. defaultSaveData: a prod mutation would leak into every
// later new game in the session). Prefer this over deepFreezeInDev when the
// frozen value is load-bearing outside development.
export function deepFreeze<T>(value: T, seen: WeakSet<object> = new WeakSet()): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  if (value instanceof Date || value instanceof RegExp) return value;
  if (seen.has(value)) return value;
  seen.add(value);
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) {
    if (child !== null && typeof child === "object") deepFreeze(child, seen);
  }
  return value;
}

export function deepFreezeInDev<T>(value: T, seen: WeakSet<object> = new WeakSet()): T {
  if (!import.meta.env.DEV) return value;
  return deepFreeze(value, seen);
}
