const deeplyFrozen = new WeakSet<object>();

// Unconditional deep freeze for shared singletons that must never be mutated
// in any build (e.g. defaultSaveData: a prod mutation would leak into every
// later new game in the session). Prefer this over deepFreezeInDev when the
// frozen value is load-bearing outside development.
export function deepFreeze<T>(value: T, seen: WeakSet<object> = new WeakSet()): T {
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date || value instanceof RegExp) return value;
  if (seen.has(value) || deeplyFrozen.has(value)) return value;
  seen.add(value);
  Object.freeze(value);
  // A shallow-frozen container can still own mutable children.
  const children = value instanceof Map ? [...value].flat() : value instanceof Set ? value : Object.values(value);
  for (const child of children) deepFreeze(child, seen);
  deeplyFrozen.add(value);
  return value;
}

export function deepFreezeInDev<T>(value: T, seen: WeakSet<object> = new WeakSet()): T {
  if (!import.meta.env.DEV) return value;
  return deepFreeze(value, seen);
}
