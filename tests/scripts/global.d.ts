declare module "*/smoke-preview.mjs" {
  export function extractBuildResourceUrls(html: string, documentUrl: string): string[];
}

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

declare module "*/clean-dev-artifacts.mjs" {
  export const DEFAULT_ARTIFACT_DIRS: readonly string[];
  export const BUILD_ARTIFACT_DIRS: readonly string[];
  export const STALE_TEST_PORTS: readonly number[];
  export function listArtifactDirsToRemove(rootDir: string, options?: { builds?: boolean }): string[];
  export function measurePath(absolutePath: string): { path: string; bytes: number };
  export function removePath(absolutePath: string): void;
  export function formatBytes(bytes: number): string;
  export function parseCleanArgs(argv: string[]): {
    help: boolean;
    builds: boolean;
    processes: boolean;
    includeDevPort: boolean;
    dryRun: boolean;
  };
}

declare module "../../scripts/lib/clean-dev-artifacts.mjs" {
  export const DEFAULT_ARTIFACT_DIRS: readonly string[];
  export const BUILD_ARTIFACT_DIRS: readonly string[];
  export const STALE_TEST_PORTS: readonly number[];
  export function listArtifactDirsToRemove(rootDir: string, options?: { builds?: boolean }): string[];
  export function measurePath(absolutePath: string): { path: string; bytes: number };
  export function removePath(absolutePath: string): void;
  export function formatBytes(bytes: number): string;
}

declare module "../../scripts/clean-dev-artifacts.mjs" {
  export function parseCleanArgs(argv: string[]): {
    help: boolean;
    builds: boolean;
    processes: boolean;
    includeDevPort: boolean;
    dryRun: boolean;
  };
}

declare module "*/asset-manifest-cache.mjs" {
  export interface ManifestEntry {
    hash: string;
    mtimeMs: number;
    size: number;
    settingsSig?: string;
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
  export function summarizeVitestFile(reportPath: string): string;
}

declare module "../../scripts/ci-summarize-vitest.mjs" {
  export function summarizeVitestReport(report: unknown, options?: { maxFailures?: number }): VitestSummary;
  export function formatVitestSummaryMarkdown(summary: VitestSummary): string;
  export function summarizeVitestFile(reportPath: string): string;
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
  export function summarizePlaywrightFile(reportPath: string): string;
}

declare module "../../scripts/ci-summarize-playwright.mjs" {
  export function summarizePlaywrightReport(report: unknown, options?: { maxFailures?: number }): PlaywrightSummary;
  export function formatPlaywrightSummaryMarkdown(summary: PlaywrightSummary): string;
  export function summarizePlaywrightFile(reportPath: string): string;
}

interface PlanMetadataResult {
  metadata: Record<string, string>;
  errors: string[];
  dates?: Record<string, Date>;
}

declare module "../../scripts/check-docs.mjs" {
  export function parsePlanMetadata(source: string): PlanMetadataResult;
  export function checkPlans(options?: { final?: boolean; keepPlan?: boolean; today?: Date }): {
    failures: string[];
    warnings: string[];
    activePlans: number;
  };
}

declare module "../../scripts/new-plan.mjs" {
  export function safePlanName(value: string): string;
  export function planTemplate(name: string, created: string, expires: string): string;
}

declare module "../../scripts/prune-transient-artifacts.mjs" {
  export function parsePruneArgs(argv: string[]): { days: number; dryRun: boolean };
  export function pruneTransientArtifacts(options?: {
    days?: number;
    dryRun?: boolean;
    now?: number;
    rootDir?: string;
    transientDirs?: readonly string[];
  }): { removed: Array<{ path: string; bytes: number }>; bytes: number };
}

declare module "../../scripts/lib/compact-output.mjs" {
  export function firstOutputLine(output: string): string;
  export function tailOutput(output: string, maxChars?: number): string;
}

interface ContextMeasurement {
  docs: Array<{ path: string; section: string | null; bytes: number }>;
  contextBytes: number;
  changedPaths: string[];
  routes: string[];
  verificationCommands: number;
  deduplicatedTestPaths: number;
  artifacts: Array<{ path: string; bytes: number }>;
  outputChars: number;
}

declare module "../../scripts/measure-agent-context.mjs" {
  export function measureContext(options?: {
    paths?: string[];
    docs?: string[];
    artifacts?: string[];
    outputFiles?: string[];
  }): ContextMeasurement;
}

interface VerificationRoute {
  id: string;
  patterns: string[];
  commands: string[];
}

interface VerificationCommand {
  key: string;
  label: string;
  command: string;
  args: string[];
}

declare module "../../scripts/verify-changed.mjs" {
  export function resolveRoutes(paths: string[]): VerificationRoute[];
  export function resolvePlan(
    paths: string[],
    options?: { e2e?: boolean | string; includeE2E?: boolean; full?: boolean },
  ): { paths: string[]; routes: VerificationRoute[]; commands: VerificationCommand[] };
  export function formatPlan(
    plan: { paths: string[]; routes: VerificationRoute[]; commands: VerificationCommand[] },
    options?: { verbosePlan?: boolean },
  ): string;
}

declare module "../../scripts/lib/current-run.mjs" {
  export function writeCurrentRun(options: {
    rootDir: string;
    status: string;
    command: string;
    artifacts?: string[];
    summary?: string;
    commit?: string | null;
  }): { jsonPath: string; markdownPath: string };
}

declare module "../../scripts/check-ci-routing.mjs" {
  export function checkCiRouting(source: string): string[];
  export function checkDiagnosticRetention(sources: Record<string, string>): string[];
}

declare module "*/check-docs.mjs" {
  export function parsePlanMetadata(source: string): PlanMetadataResult;
  export function checkPlans(options?: { final?: boolean; keepPlan?: boolean; today?: Date }): {
    failures: string[];
    warnings: string[];
    activePlans: number;
  };
}

declare module "*/new-plan.mjs" {
  export function safePlanName(value: string): string;
  export function planTemplate(name: string, created: string, expires: string): string;
}

declare module "*/prune-transient-artifacts.mjs" {
  export function parsePruneArgs(argv: string[]): { days: number; dryRun: boolean };
  export function pruneTransientArtifacts(options?: {
    days?: number;
    dryRun?: boolean;
    now?: number;
    rootDir?: string;
    transientDirs?: readonly string[];
  }): { removed: Array<{ path: string; bytes: number }>; bytes: number };
}

declare module "*/compact-output.mjs" {
  export function firstOutputLine(output: string): string;
  export function tailOutput(output: string, maxChars?: number): string;
}

declare module "*/measure-agent-context.mjs" {
  export function measureContext(options?: {
    paths?: string[];
    docs?: string[];
    artifacts?: string[];
    outputFiles?: string[];
  }): ContextMeasurement;
}

declare module "*/verify-changed.mjs" {
  export function resolveRoutes(paths: string[]): VerificationRoute[];
  export function resolvePlan(
    paths: string[],
    options?: { e2e?: boolean | string; includeE2E?: boolean; full?: boolean },
  ): { paths: string[]; routes: VerificationRoute[]; commands: VerificationCommand[] };
  export function formatPlan(
    plan: { paths: string[]; routes: VerificationRoute[]; commands: VerificationCommand[] },
    options?: { verbosePlan?: boolean },
  ): string;
}

declare module "*/current-run.mjs" {
  export function writeCurrentRun(options: {
    rootDir: string;
    status: string;
    command: string;
    artifacts?: string[];
    summary?: string;
    commit?: string | null;
  }): { jsonPath: string; markdownPath: string };
}

declare module "*/check-ci-routing.mjs" {
  export function checkCiRouting(source: string): string[];
  export function checkDiagnosticRetention(sources: Record<string, string>): string[];
}
