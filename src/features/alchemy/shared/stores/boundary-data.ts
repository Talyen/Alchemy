import { current, isDraft, type Draft } from "immer";
import { assertSynchronousResult } from "./command-outcome";

type BoundaryPolicy = "input" | "snapshot" | "result";

/** One ownership graph for every supported value, including built-in metadata. */
export function copyBoundaryData<T>(value: T, policy: BoundaryPolicy, readSources: WeakMap<object, object>): Draft<T> {
  const copies = new WeakMap<object, object>();
  function copy(entry: unknown): unknown {
    if (policy === "result" && typeof entry === "function") {
      assertSynchronousResult(entry);
      throw new Error("Command results must contain only data; a function cannot leave its command");
    }
    if (entry === null || typeof entry !== "object") return entry;
    const readSource = readSources.get(entry);
    if (policy === "input" && (readSource || isDraft(entry))) {
      const owned = readSource ?? entry;
      return isDraft(owned) ? current(owned) : owned;
    }
    const source = readSource ?? entry;
    const existing = copies.get(source);
    if (existing) return existing;

    const properties = Reflect.ownKeys(source).map(
      (key) => [key, Reflect.getOwnPropertyDescriptor(source, key)] as const,
    );
    // Inspect descriptors once, without executing own getters at the boundary.
    for (const [, descriptor] of properties) {
      if (descriptor && !("value" in descriptor)) {
        throw new Error("Accessors cannot cross the gameplay command data boundary");
      }
    }
    assertSynchronousResult(source);

    // A fallback structuredClone here would start another ownership graph and
    // silently strip prototypes, metadata, and links back to surrounding data.
    const prototype = Object.getPrototypeOf(source) as object | null;
    let result: object;
    if (Array.isArray(source) && prototype === Array.prototype) result = new Array(source.length);
    else if (prototype === Object.prototype || prototype === null) result = Object.create(prototype) as object;
    else if (prototype === Map.prototype) result = new Map<unknown, unknown>();
    else if (prototype === Set.prototype) result = new Set<unknown>();
    else if (prototype === Date.prototype) result = new Date(Date.prototype.getTime.call(source));
    // RegExp has only scalar internal slots. Clone those intrinsically; its
    // metadata still traverses this graph below, including lastIndex.
    else if (prototype === RegExp.prototype) result = structuredClone(source as RegExp);
    else throw new Error("Unsupported data prototype at the gameplay command boundary");
    copies.set(source, result);

    if (source instanceof Map && result instanceof Map) {
      for (const [key, item] of Map.prototype.entries.call(source)) result.set(copy(key), copy(item));
    } else if (source instanceof Set && result instanceof Set) {
      for (const item of Set.prototype.values.call(source)) result.add(copy(item));
    }
    for (const [key, descriptor] of properties) {
      if (!descriptor || (Array.isArray(source) && key === "length")) continue;
      const copied = copy(descriptor.value);
      if (result instanceof RegExp && key === "lastIndex") {
        result.lastIndex = copied as number;
      } else {
        Object.defineProperty(result, key, {
          value: copied,
          enumerable: descriptor.enumerable ?? false,
          configurable: true,
          writable: true,
        });
      }
    }
    return result;
  }
  return copy(value) as Draft<T>;
}
