export type LocalStorageReadResult = { ok: true; value: string | null } | { ok: false; error: unknown };
export type LocalStorageWriteResult = { ok: true } | { ok: false; error: unknown };

/** True outside SSR/test-node. Does not imply storage access will succeed. */
export function isClientContext(): boolean {
  return typeof window !== "undefined";
}

function getBrowserStorage(): Storage | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
    if (typeof localStorage !== "undefined") return localStorage;
  } catch {
    return null;
  }
  return null;
}

function unavailableResult(): { ok: false; error: unknown } {
  return { ok: false, error: new Error("localStorage is unavailable in this context") };
}

/** True when a browser storage object can currently be reached. Guards silent early-outs. */
export function isLocalStorageAvailable(): boolean {
  return getBrowserStorage() !== null;
}

/** Single guarded access path for browser localStorage. Never throws. */
export function tryLocalStorageGetItem(key: string): LocalStorageReadResult {
  const storage = getBrowserStorage();
  if (!storage) return unavailableResult();
  try {
    return { ok: true, value: storage.getItem(key) };
  } catch (error) {
    return { ok: false, error };
  }
}

/** Single guarded write path for browser localStorage. Never throws. */
export function tryLocalStorageSetItem(key: string, value: string): LocalStorageWriteResult {
  const storage = getBrowserStorage();
  if (!storage) return unavailableResult();
  try {
    storage.setItem(key, value);
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

/** Single guarded removal path for browser localStorage. Never throws. */
export function tryLocalStorageRemoveItem(key: string): LocalStorageWriteResult {
  const storage = getBrowserStorage();
  if (!storage) return unavailableResult();
  try {
    storage.removeItem(key);
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}
