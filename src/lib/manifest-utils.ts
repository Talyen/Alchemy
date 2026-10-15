export function createNumericManifest<K extends string>(keys: readonly K[]): Record<K, number> {
  if (import.meta.env?.DEV && new Set(keys).size !== keys.length) {
    throw new Error(
      `createNumericManifest: duplicate keys (expected ${keys.length} unique, got ${new Set(keys).size})`,
    );
  }
  const manifest = {} as Record<K, number>;
  for (const key of keys) {
    manifest[key] = 0;
  }
  return manifest;
}
