export function createNumericManifest<K extends string>(keys: readonly K[]): Record<K, number> {
  const manifest = {} as Record<K, number>;
  for (const key of keys) {
    manifest[key] = 0;
  }
  if (import.meta.env.DEV && Object.keys(manifest).length !== keys.length) {
    throw new Error(
      `createNumericManifest: duplicate or missing keys (expected ${keys.length}, got ${Object.keys(manifest).length})`,
    );
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
