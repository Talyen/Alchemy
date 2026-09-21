export function resolveRootDir(importMetaUrl: string): string;

export function getManagedManifestPath(rootDir: string, managedKey: string): string;

export function resolvePipelinePaths(
  importMetaUrl: string,
  options: { sourceSubpath: string[]; managedKey: string },
): { rootDir: string; sourceDir: string; outputDir: string; manifestPath: string };

export function ensureOutputDir(outputDir: string, options?: { check?: boolean }): Promise<void>;

export function readSourceDir(
  dir: string,
  context?: string,
): Promise<Array<{ name: string } & Record<string, unknown>>>;

export function runManifestPipeline(options: Record<string, unknown>): Promise<Record<string, unknown>>;
