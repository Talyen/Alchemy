import { current, isDraft, type Draft, type Immutable } from "immer";

const sources = new WeakMap<object, object>();

/** A live view of a draft: domain operations can change it, consumers cannot. */
export function createReadonlyView<T>(source: T): Immutable<T> {
  const views = new WeakMap<object, object>();
  function wrap(value: unknown): unknown {
    if (value === null || typeof value !== "object") return value;
    const existing = views.get(value);
    if (existing) return existing;
    // A separate target avoids Proxy invariants on frozen state and catalogs.
    const target = Array.isArray(value) ? [] : {};
    const deny = (): never => {
      throw new Error("Gameplay reads are readonly; use a domain operation");
    };
    const view = new Proxy(target, {
      get: (_target, key, receiver) => {
        // Never expose Immer's internal draft state through a read capability.
        if (key === Symbol.for("immer-state")) return undefined;
        return wrap(Reflect.get(value, key, receiver));
      },
      has: (_target, key) => Reflect.has(value, key),
      ownKeys: () => Reflect.ownKeys(value),
      getOwnPropertyDescriptor: (_target, key) => {
        const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
        if (!descriptor) return undefined;
        return {
          configurable: key !== "length" || !Array.isArray(value),
          enumerable: descriptor.enumerable ?? false,
          writable: true,
          value: wrap(Reflect.get(value, key)),
        };
      },
      set: deny,
      deleteProperty: deny,
      defineProperty: deny,
      setPrototypeOf: deny,
      preventExtensions: deny,
    });
    views.set(value, view);
    sources.set(view, value);
    return view;
  }
  return wrap(source) as Immutable<T>;
}

/** Detach a read value before handing it to an engine API or returning it. */
export function snapshotReadonlyValue<T>(value: T): Draft<T> {
  const source = value && typeof value === "object" ? (sources.get(value) ?? value) : value;
  if (isDraft(source)) return structuredClone(current(source as Draft<object>)) as Draft<T>;
  if (Array.isArray(source)) return source.map(snapshotReadonlyValue) as Draft<T>;
  if (source && typeof source === "object") {
    return Object.fromEntries(
      (Object.entries(source) as Array<[string, unknown]>).map(([key, entry]) => [key, snapshotReadonlyValue(entry)]),
    ) as Draft<T>;
  }
  return source as Draft<T>;
}

/** Strip read facades from assigned values, preserving ordinary input identities. */
export function unwrapReadonlyValue<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  const source = sources.get(value);
  if (source) return (isDraft(source) ? current(source) : source) as T;
  const entries = Object.entries(value) as Array<[string, unknown]>;
  const unwrapped = entries.map(([key, entry]) => [key, unwrapReadonlyValue(entry)] as const);
  if (unwrapped.every(([, entry], index) => entry === entries[index]![1])) return value;
  return (Array.isArray(value) ? unwrapped.map(([, entry]) => entry) : Object.fromEntries(unwrapped)) as T;
}
