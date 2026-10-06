export function resolveRootDir(importMetaUrl: string): string;

export function getManagedManifestPath(rootDir: string, managedKey: string): string;

export function resolvePipelinePaths(
  importMetaUrl: string,
  options: { managedKey: string },
): { rootDir: string; outputDir: string; manifestPath: string };

export function ensureOutputDir(outputDir: string, options?: { check?: boolean }): Promise<void>;
export function writeStagedOutput(
  outputPath: string,
  transform: (temporaryPath: string) => Promise<unknown>,
): Promise<void>;

export function runManifestPipeline(options: Record<string, unknown>): Promise<Record<string, unknown>>;
