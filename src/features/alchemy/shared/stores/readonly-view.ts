import { assertSynchronousResult } from "./command-outcome";
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

/** Detach data while the draft is open; preserve aliases and cycles within the result. */
export function snapshotReadonlyValue<T>(value: T): Draft<T> {
  return copyBoundaryValue(value, false);
}

/** Commit results are data; executable dependencies must never reach deferred consumers. */
export function snapshotCommandResult<T>(value: T): Draft<T> {
  return copyBoundaryValue(value, false, true);
}

/** Own caller data on ingress; existing read capabilities already belong to the transaction. */
export function ownTransactionInput<T>(value: T): Draft<T> {
  return copyBoundaryValue(value, true);
}

function copyBoundaryValue<T>(value: T, retainReadSources: boolean, dataOnly = false): Draft<T> {
  const copies = new WeakMap<object, object>();
  function copy(entry: unknown): unknown {
    if (dataOnly) {
      assertSynchronousResult(entry);
      if (typeof entry === "function") {
        throw new Error("Command results must contain only data; a function cannot leave its command");
      }
    }
    if (entry === null || typeof entry !== "object") return entry;
    const readSource = sources.get(entry);
    if (retainReadSources && (readSource || isDraft(entry))) {
      const owned = readSource ?? entry;
      return isDraft(owned) ? current(owned) : owned;
    }
    const source = readSource ?? entry;
    const existing = copies.get(source);
    if (existing) return existing;
    const data = source;
    if (data instanceof Map) {
      const result = new Map<unknown, unknown>();
      copies.set(source, result);
      for (const [key, item] of data) result.set(copy(key), copy(item));
      return result;
    }
    if (data instanceof Set) {
      const result = new Set<unknown>();
      copies.set(source, result);
      for (const item of data) result.add(copy(item));
      return result;
    }
    const prototype = Object.getPrototypeOf(data) as object | null;
    if (Array.isArray(data) || prototype === Object.prototype || prototype === null) {
      const result: object = Array.isArray(data) ? new Array(data.length) : (Object.create(prototype) as object);
      copies.set(source, result);
      for (const key of Reflect.ownKeys(data)) {
        if (!Object.prototype.propertyIsEnumerable.call(data, key)) continue;
        Object.defineProperty(result, key, {
          value: copy(Reflect.get(data, key)),
          enumerable: true,
          configurable: true,
          writable: true,
        });
      }
      return result;
    }
    const result = structuredClone(isDraft(data) ? current(data) : data);
    copies.set(source, result);
    return result;
  }
  return copy(value) as Draft<T>;
}
