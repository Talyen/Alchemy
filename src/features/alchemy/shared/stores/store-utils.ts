const deeplyFrozen = new WeakSet<object>();

// Shared data and published gameplay must remain immutable in every build.
// Cache fully traversed objects so structurally shared revisions only visit
// changed branches; a shallow-frozen object still needs its children checked.
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
