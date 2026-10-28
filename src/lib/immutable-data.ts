// Only cache derived values when every reachable data property is frozen.
// A frozen array alone does not make its elements or nested effect branches immutable.
const verified = new WeakSet<object>();

export function isDeeplyFrozenData(value: object): boolean {
  if (verified.has(value)) return true;
  if (!Object.isFrozen(value)) return false;
  const pending: object[] = [value];
  const seen = new Set<object>();
  while (pending.length) {
    const current = pending.pop()!;
    if (verified.has(current) || seen.has(current)) continue;
    if (!Object.isFrozen(current)) return false;
    const prototype: unknown = Object.getPrototypeOf(current);
    if (Array.isArray(current) ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null)
      return false;
    seen.add(current);
    for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(current))) {
      if (!("value" in descriptor)) return false;
      const child: unknown = descriptor.value;
      if (typeof child === "function") return false;
      if (child !== null && typeof child === "object") pending.push(child);
    }
  }
  for (const entry of seen) verified.add(entry);
  return true;
}
