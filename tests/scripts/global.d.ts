declare module "*/patch-notes-core.mjs" {
  export function buildChangelogUnreleased(commits: Array<{ subject: string; body: string }>): string;
  export function buildPatchNotesMarkdown(tag: string, commits: Array<{ subject: string; body: string }>): string;
  export function extractChangelogSection(content: string, heading: string): string;
  export function extractPlayerFacingLines(commit: { subject: string; body: string }): string[];
  export function parseChangelogCommits(section: string): Array<{ subject: string; body: string }>;
  export function parseConventionalCommit(header: string): {
    type: string;
    scope: string | undefined;
    include: boolean;
  };
  export function promoteUnreleasedSection(source: string, version: string, date: string): string;
  export function replaceChangelogUnreleased(source: string, newSection: string): string;
}

declare module "*/steam-vdf.mjs" {
  export function resolveSteamContentRoot(root: string): string;
  export function substituteSteamVdf(template: string, values: Record<string, string>): string;
  export function writeSteamBuildVdfs(
    root: string,
    env: { STEAM_APP_ID: string; STEAM_DEPOT_ID: string; [key: string]: string },
  ): { appPath: string; depotPath: string; buildDir: string; contentRoot: string };
}

declare module "*/sync-changelog.mjs" {
  export function syncChangelog(root: { root: string }): string;
  export function computeSyncedChangelog(existingContent: string, rootDir?: string): string;
}

declare module "../../scripts/lib/steam-vdf.mjs" {
  export function resolveSteamContentRoot(root: string): string;
  export function substituteSteamVdf(template: string, values: Record<string, string>): string;
  export function writeSteamBuildVdfs(
    root: string,
    env: { STEAM_APP_ID: string; STEAM_DEPOT_ID: string; [key: string]: string },
  ): { appPath: string; depotPath: string; buildDir: string; contentRoot: string };
}

declare module "../../scripts/sync-changelog.mjs" {
  export function syncChangelog(root: { root: string }): string;
  export function computeSyncedChangelog(existingContent: string, rootDir?: string): string;
}

declare module "*/prettier-paths.mjs" {
  export const PRETTIER_GLOBS: readonly string[];
  export function filterPrettierPaths(paths: readonly string[]): string[];
}

declare module "../../scripts/prettier-paths.mjs" {
  export const PRETTIER_GLOBS: readonly string[];
  export function filterPrettierPaths(paths: readonly string[]): string[];
}

declare module "*/asset-manifest-cache.mjs" {
  export interface ManifestEntry {
    hash: string;
    mtimeMs: number;
    size: number;
  }
  export function computeContentHash(
    sourcePath: string,
    settings: Record<string, unknown>,
    schemaVersion: string | number,
  ): Promise<string>;
  export function resolveSourceHash(
    sourcePath: string,
    settings: Record<string, unknown>,
    schemaVersion: string | number,
    storedEntry: ManifestEntry | undefined,
  ): Promise<ManifestEntry>;
  export function loadManifest(manifestPath: string): Promise<Record<string, ManifestEntry>>;
  export function isOutputFresh(
    outputPath: string,
    storedEntry: ManifestEntry | string | undefined,
    expectedHash: string,
  ): Promise<boolean>;
  export function writeManifestIfChanged(
    manifestPath: string,
    entries: Record<string, ManifestEntry>,
  ): Promise<boolean>;
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
}

declare module "*/map-pool.mjs" {
  export function mapPool<T, R>(
    items: readonly T[],
    concurrency: number,
    mapper: (item: T, index: number) => Promise<R>,
  ): Promise<R[]>;
}

declare module "*/write-text-if-changed.mjs" {
  export function writeTextIfChanged(filePath: string, content: string): Promise<boolean>;
}

declare module "*/kebab-to-camel.mjs" {
  export function kebabToCamel(name: string): string;
}

interface VitestFailure {
  file: string;
  title: string;
  message: string;
}
interface VitestSummary {
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  numPendingTests: number;
  failures: VitestFailure[];
}

declare module "*/ci-summarize-vitest.mjs" {
  export function summarizeVitestReport(report: unknown, options?: { maxFailures?: number }): VitestSummary;
  export function formatVitestSummaryMarkdown(summary: VitestSummary): string;
  export function summarizeVitestFile(reportPath: string): VitestSummary;
}

declare module "../../scripts/ci-summarize-vitest.mjs" {
  export function summarizeVitestReport(report: unknown, options?: { maxFailures?: number }): VitestSummary;
  export function formatVitestSummaryMarkdown(summary: VitestSummary): string;
  export function summarizeVitestFile(reportPath: string): VitestSummary;
}

interface PlaywrightFailure {
  file: string;
  title: string;
  message: string;
  status: string;
}
interface PlaywrightSummary {
  total: number;
  expected: number;
  unexpected: number;
  flaky: number;
  skipped: number;
  failures: PlaywrightFailure[];
}

declare module "*/ci-summarize-playwright.mjs" {
  export function summarizePlaywrightReport(report: unknown, options?: { maxFailures?: number }): PlaywrightSummary;
  export function formatPlaywrightSummaryMarkdown(summary: PlaywrightSummary): string;
  export function summarizePlaywrightFile(reportPath: string): PlaywrightSummary;
}

declare module "../../scripts/ci-summarize-playwright.mjs" {
  export function summarizePlaywrightReport(report: unknown, options?: { maxFailures?: number }): PlaywrightSummary;
  export function formatPlaywrightSummaryMarkdown(summary: PlaywrightSummary): string;
  export function summarizePlaywrightFile(reportPath: string): PlaywrightSummary;
}
