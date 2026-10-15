const deeplyFrozen = new WeakSet<object>();

/** Published gameplay is plain data: freezing built-in internal slots cannot make them immutable. */
export function deepFreeze<T>(value: T): T {
  const seen = new WeakSet<object>();
  const pending: object[] = [];
  function inspect(entry: unknown): void {
    if (typeof entry === "function") throw new Error("Gameplay state must contain only plain data, not functions");
    if (entry === null || typeof entry !== "object" || deeplyFrozen.has(entry) || seen.has(entry)) return;
    const prototype = Object.getPrototypeOf(entry) as object | null;
    if (Array.isArray(entry) ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null)
      throw new Error("Gameplay state must contain only plain data records and arrays");
    seen.add(entry);
    pending.push(entry);
    for (const key of Reflect.ownKeys(entry)) {
      const descriptor = Object.getOwnPropertyDescriptor(entry, key)!;
      if (!("value" in descriptor)) throw new Error("Gameplay state cannot contain data accessors");
      inspect(descriptor.value);
    }
  }
  // Validate the whole changed graph before freezing any part of it.
  inspect(value);
  for (const entry of pending.reverse()) {
    Object.freeze(entry);
    deeplyFrozen.add(entry);
  }
  return value;
}
