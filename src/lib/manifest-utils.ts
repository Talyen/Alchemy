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

export function mergeNumericManifests<T extends Record<string, number>>(
  base: T,
  addition: T,
  keys: ReadonlyArray<keyof T>,
): T {
  const merged = { ...base };
  for (const key of keys) {
    merged[key] = ((base[key] as number) + (addition[key] as number)) as T[keyof T];
  }
  return merged;
}
