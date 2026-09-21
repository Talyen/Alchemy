export interface ManifestEntry {
  hash: string;
  outputHash?: string;
  owner?: string;
}

export function computeContentHash(
  sourcePath: string,
  settings: Record<string, unknown>,
  schemaVersion: string | number,
): Promise<string>;

export function computeOutputHash(outputPath: string): Promise<string>;

export function withOutputHash(sourceEntry: ManifestEntry, outputPath: string): Promise<ManifestEntry>;

export function resolveSourceHash(
  sourcePath: string,
  settings: Record<string, unknown>,
  schemaVersion: string | number,
): Promise<ManifestEntry>;

export function loadManifest(manifestPath: string): Promise<Record<string, ManifestEntry>>;

export function isOutputFresh(
  outputPath: string,
  storedEntry: ManifestEntry | string | undefined,
  expectedHash: string,
): Promise<boolean>;

export function writeManifestIfChanged(manifestPath: string, entries: Record<string, ManifestEntry>): Promise<boolean>;

export function removeOrphanOutputs(
  outputDir: string,
  keepNames: Set<string>,
  options?: { manifestBasename?: string; label?: string },
): Promise<number>;

export function processManifestEntries<T, R extends { entry?: ManifestEntry | null }>(options: {
  entries: T[];
  manifestPath: string;
  concurrency?: number;
  keyOf?: (entry: T) => string;
  processEntry: (entry: T, storedEntry: ManifestEntry | undefined) => Promise<R>;
  handleError?: (entry: T, error: unknown) => R;
}): Promise<{
  previousManifest: Record<string, ManifestEntry>;
  results: Array<R & { item: T; key: string; failed: boolean }>;
  nextManifest: Record<string, ManifestEntry>;
  failed: boolean;
}>;
