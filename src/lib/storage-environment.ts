export type LocalStorageReadResult = { ok: true; value: string | null } | { ok: false; error: unknown };
export type LocalStorageWriteResult = { ok: true } | { ok: false; error: unknown };

/** True outside SSR/test-node. Does not imply storage access will succeed. */
export function isClientContext(): boolean {
  return typeof window !== "undefined";
}

/** Sentinel message shared by unavailableResult and isStorageUnavailable so rewording one cannot desync the other. */
const STORAGE_UNAVAILABLE_MESSAGE = "localStorage is unavailable in this context";

function unavailableResult(): { ok: false; error: unknown } {
  return { ok: false, error: new Error(STORAGE_UNAVAILABLE_MESSAGE) };
}

/** True for the sentinel unavailable error so callers can stay silent without a pre-check lookup. */
export function isStorageUnavailable(error: unknown): boolean {
  return error instanceof Error && error.message === STORAGE_UNAVAILABLE_MESSAGE;
}

function withBrowserStorage<T extends { ok: true }>(
  operation: (storage: Storage) => T,
): T | { ok: false; error: unknown } {
  try {
    const storage =
      (typeof window !== "undefined" ? window.localStorage : undefined) ??
      (typeof localStorage !== "undefined" ? localStorage : undefined);
    if (!storage) return unavailableResult();
    return operation(storage);
  } catch (error) {
    return { ok: false, error };
  }
}

/** Single guarded access path for browser localStorage. Never throws. */
export function tryLocalStorageGetItem(key: string): LocalStorageReadResult {
  return withBrowserStorage((storage) => ({ ok: true, value: storage.getItem(key) }));
}

/** Single guarded write path for browser localStorage. Never throws. */
export function tryLocalStorageSetItem(key: string, value: string): LocalStorageWriteResult {
  return withBrowserStorage((storage) => {
    storage.setItem(key, value);
    return { ok: true };
  });
}

/** Single guarded removal path for browser localStorage. Never throws. */
export function tryLocalStorageRemoveItem(key: string): LocalStorageWriteResult {
  return withBrowserStorage((storage) => {
    storage.removeItem(key);
    return { ok: true };
  });
}
