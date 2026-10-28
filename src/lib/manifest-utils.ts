export function createNumericManifest<K extends string>(keys: readonly K[]): Record<K, number> {
  if (import.meta.env?.DEV && new Set(keys).size !== keys.length) {
    throw new Error(
      `createNumericManifest: duplicate keys (expected ${keys.length} unique, got ${new Set(keys).size})`,
    );
  }
  const manifest = {} as Record<K, number>;
  for (const key of keys) {
    // Assignment to __proto__ on a plain object invokes its legacy setter.
    // Define it as data so every requested string remains an own key.
    if (key === "__proto__")
      Object.defineProperty(manifest, key, { value: 0, writable: true, enumerable: true, configurable: true });
    else manifest[key] = 0;
  }
  return manifest;
}
