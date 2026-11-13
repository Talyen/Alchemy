export function getOptimizedManifestPath(rootDir: string): string;

export function readArtManifest(manifestPath: string): Promise<Record<string, string | { hash: string }>>;

export function runSyncGenerated<T extends { content: string }>(options: {
  result: T;
  outputFile: string;
  rootDir: string;
  check?: boolean;
  onCount: (result: T) => number;
  label: string;
}): Promise<T & { wrote: boolean }>;
