import { copyBoundaryData } from "./boundary-data";
import type { Draft, Immutable } from "immer";

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
  return copyBoundaryData(value, "snapshot", sources);
}

/** Commit results are data; executable dependencies must never reach deferred consumers. */
export function snapshotCommandResult<T>(value: T): Draft<T> {
  return copyBoundaryData(value, "result", sources);
}

/** Own caller data on ingress; existing read capabilities already belong to the transaction. */
export function ownTransactionInput<T>(value: T): Draft<T> {
  return copyBoundaryData(value, "input", sources);
}
