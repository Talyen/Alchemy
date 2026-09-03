declare module "*/assets/asset-manifest.mjs" {
  export const staticAssets: Array<{ source: string; target: string; width: number; quality: number }>;
  export function validateAssetRegistry(
    entries: Array<{ source: string; target: string }>,
    options?: { sourceDir?: string },
  ): Promise<Array<{ source: string; target: string }>>;
}

declare module "*/check-bundle-budget.mjs" {
  export function checkBundleBudget(dist?: string): boolean;
}

declare module "*/bundle-budget.mjs" {
  export const BUDGETS: Readonly<{
    indexMaxBytes: number;
    totalJsMaxBytes: number;
  }>;
  export const CHUNK_SIZE_WARNING_KB: number;
}

interface PatchNoteCommit {
  subject: string;
  body: string;
  files?: string[];
}

declare module "*/patch-notes-core.mjs" {
  export function buildChangelogUnreleased(commits: Array<{ subject: string; body: string }>): string;
  export function buildPatchNotesMarkdown(tag: string, commits: PatchNoteCommit[], knownIssues?: string[]): string;
  export function extractChangelogSection(content: string, heading: string): string;
  export function extractPlayerFacingLines(commit: PatchNoteCommit): string[];
  export function isInfraPath(filePath: string): boolean;
  export function isProductPath(filePath: string): boolean;
  export function isUserFacing(commit: PatchNoteCommit): boolean;
  export function parseChangelogCommits(section: string): Array<{ subject: string; body: string }>;
  export function parseConventionalCommit(header: string): {
    type: string;
    scope: string | undefined;
    include: boolean;
  };
  export function promoteUnreleasedSection(source: string, version: string, date: string): string;
  export function replaceChangelogUnreleased(source: string, newSection: string): string;
  export function userFacingTrailer(body: string): "yes" | "no" | null;
}

declare module "*/git-release.mjs" {
  export function listVersionTags(root: string): string[];
  export function latestVersionTag(root: string): string | null;
  export function previousVersionTag(root: string, currentTag: string): string | null;
  export function latestCommitHash(root: string, short?: boolean): string;
  export function resolvePatchNoteRange(
    root: string,
    releaseTag?: string | null,
  ): { since: string | null; until: string };
  export function getCommitsSinceTag(
    root: string,
    tag: string | null,
    options?: { until?: string },
  ): Array<{ subject: string; body: string; files: string[] }> | null;
}

declare module "*/generate-patch-notes.mjs" {
  export function parseGeneratePatchNotesArgs(
    argv: string[],
    env?: NodeJS.ProcessEnv,
  ): { dryRun: boolean; releaseVersion: string };
  export function generatePatchNotesMarkdown(
    rootDir: string,
    options?: { releaseVersion?: string },
  ): { version: string; outputName: string; commits: PatchNoteCommit[]; markdown: string };
}

declare module "*/release-runner.mjs" {
  export function parseReleaseArgs(argv: string[]): { dryRun: boolean };
  export function runRelease(options: {
    label: string;
    gates: string[][];
    bumpArgs?: string[];
    dryRun?: boolean;
  }): Promise<void>;
}

declare module "*/desktop-artifact.mjs" {
  export function steamContentRoot(root: string): string;
}

declare module "*/steam-vdf.mjs" {
  export function substituteSteamVdf(template: string, values: Record<string, string>): string;
  export function writeSteamBuildVdfs(
    root: string,
    env: { STEAM_APP_ID: string; STEAM_DEPOT_ID: string; [key: string]: string },
  ): { appPath: string; depotPath: string; buildDir: string; contentRoot: string };
}

declare module "*/sync-changelog.mjs" {
  export function computeSyncedChangelog(existingContent: string, rootDir?: string): string;
}

declare module "*/prettier-paths.mjs" {
  export const PRETTIER_GLOBS: readonly string[];
  export function filterPrettierPaths(paths: readonly string[]): string[];
}

declare module "*/clean-dev-artifacts.mjs" {
  export const TRANSIENT_ARTIFACT_DIRS: readonly string[];
  export const DEFAULT_ARTIFACT_DIRS: readonly string[];
  export const BUILD_ARTIFACT_DIRS: readonly string[];
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

declare module "*/asset-manifest-cache.mjs" {
  export interface ManifestEntry {
    hash: string;
    mtimeMs: number;
    size: number;
    settingsSig?: string;
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

declare module "*/assets/sound-assets.mjs" {
  export const generatedSoundAssets: Array<{ source: string; target: string }>;
  export const curatedSoundFiles: string[];
  export function validateSoundAssetRegistry(options?: { sourceDir?: string }): Promise<void>;
}

declare module "*/map-pool.mjs" {
  export function mapPool<T, R>(
    items: readonly T[],
    concurrency: number,
    mapper: (item: T, index: number) => Promise<R>,
  ): Promise<R[]>;
}

declare module "*/write-text-if-changed.mjs" {
  export function writeTextIfChanged(
    filePath: string,
    content: string,
    options?: { check?: boolean },
  ): Promise<boolean>;
}

declare module "*/kebab-to-camel.mjs" {
  export function kebabToCamel(name: string): string;
}

declare module "*/sync-generated-helpers.mjs" {
  export const WEBP_SUFFIX: string;
  export const GEAR_PREFIX: string;
  export function isWebpAsset(name: string): boolean;
  export function isGearAsset(name: string): boolean;
  export function getAssetFiles(manifest: Record<string, unknown>): string[];
  export function getGearFiles(manifest: Record<string, unknown>): string[];
}

declare module "*/ci-summarize.mjs" {
  export function parseSummaryArgs(args: string[]): {
    vitest: boolean;
    playwright: boolean;
    vitestPath: string;
    playwrightPath: string;
  };
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

interface PlaywrightFailure {
  file: string;
  line: number;
  title: string;
  message: string;
  status: string;
  digestPath: string | null;
}
interface PlaywrightSummary {
  total: number;
  expected: number;
  unexpected: number;
  flaky: number;
  skipped: number;
  failures: PlaywrightFailure[];
}

declare module "*/playwright-summary.mjs" {
  export function collectPlaywrightTests(report: unknown): {
    allTests: Array<Record<string, unknown>>;
    totalTests: number;
    passedTests: number;
    skippedTests: number;
    failedTests: Array<Record<string, unknown>>;
    flakyTests: Array<Record<string, unknown>>;
  };
  export function summarizePlaywrightReport(
    report: unknown,
    options?: { maxFailures?: number; rootDir?: string; runId?: string },
  ): PlaywrightSummary;
  export function formatPlaywrightSummaryMarkdown(summary: PlaywrightSummary): string;
  export function summarizePlaywrightFile(reportPath: string): string;
}

interface PlanMetadataResult {
  metadata: Record<string, string>;
  errors: string[];
  updated?: Date;
}

interface ContextMeasurement {
  changedPaths: string[];
  routes: string[];
  instructions: Array<{ path: string; heading: string | null; reason: string; kind: string; bytes: number }>;
  ownerDocs: Array<{ path: string; heading: string | null; reason: string; kind: string; bytes: number }>;
  docs: Array<{ path: string; heading: string | null; reason: string; kind: string; bytes: number }>;
  instructionBytes: number;
  ownerDocBytes: number;
  selectedBytes: number;
  changedFileBytes: number;
  totalContextBytes: number;
  verificationCommands: number;
  deduplicatedTestPaths: number;
  artifacts: Array<{ path: string; bytes: number }>;
  artifactBytes: number;
  outputs: Array<{ path: string; bytes: number }>;
  namedOutputBytes: number;
}

interface VerificationRoute {
  id: string;
  patterns: string[];
  commands: string[];
  unknown?: boolean;
}

interface VerificationCommand {
  key: string;
  label: string;
  reason: string;
  command: string;
  args: string[];
}

declare module "*/change-routes.mjs" {
  export const ROUTES: readonly VerificationRoute[];
  export function validateRouteCatalog(options?: { rootDir?: string }): string[];
  export function resolveRoutes(paths: string[]): VerificationRoute[];
  export function resolveRoutePlan(paths: string[]): {
    paths: string[];
    routes: VerificationRoute[];
    commands: VerificationCommand[];
  };
}

interface PlaywrightDiagnosticInput {
  runId?: string;
  rootDir?: string;
  title: string;
  file: string;
  line?: number;
  project?: string;
  status: string | undefined;
  duration: number;
  url?: string;
  errorMessage?: string;
  logs?: string[];
  accessibilitySnapshot?: string;
  htmlFallback?: string;
}

interface PlaywrightDiagnostic {
  runId: string;
  identity: { id: string; file: string; line: number; project: string; title: string };
  markdown: string;
  omittedLogs: number;
  omittedContextBytes: number;
  contextKind: "accessibility" | "html-fallback";
}

declare module "*/playwright-diagnostics.mjs" {
  export const MAX_DIAGNOSTIC_BYTES: number;
  export function diagnosticIdentity(input: {
    rootDir?: string;
    file: string;
    line?: number;
    project?: string;
    title: string;
  }): PlaywrightDiagnostic["identity"];
  export function failureDigestRelativePath(runId: string, diagnosticId: string): string;
  export function buildFailureDiagnostic(
    input: PlaywrightDiagnosticInput,
    options?: { maxBytes?: number },
  ): PlaywrightDiagnostic;
  export function writeFailureDiagnostic(
    rootDir: string,
    diagnostic: PlaywrightDiagnostic,
  ): { digestPath: string; recordPath: string };
  export function writeFailureIndex(
    rootDir: string,
    runId?: string,
  ): {
    indexPath: string;
    failures: Array<{ id: string; runId: string; digestPath: string; bytes: number }>;
  };
}

declare module "*/playwright-run-reporter.mjs" {
  export default class PlaywrightRunReporter {
    runId: string;
    onBegin(
      config: unknown,
      suite: { allTests(): Array<{ outcome(): "expected" | "unexpected" | "flaky" | "skipped" }> },
    ): void;
    onEnd(): void;
  }
}

declare module "*/check-plans.mjs" {
  export function parsePlanMetadata(source: string): PlanMetadataResult;
  export function checkPlans(options?: { final?: boolean; today?: Date }): {
    failures: string[];
    warnings: string[];
    activePlans: number;
  };
}

declare module "*/check-documentation-contract.mjs" {
  export const DOCUMENTATION_CONTRACTS: ReadonlyArray<readonly [string, () => string[]]>;
  export const ADVISORY_DOCUMENTATION_CONTRACTS: ReadonlyArray<readonly [string, () => string[]]>;
  export function checkLocalMarkdownLinks(): string[];
  export function checkInlineRepositoryPaths(): string[];
  export function checkBacktickedCurrentFileReferences(): string[];
  export function checkDocumentedNpmScripts(): string[];
  export function checkMarkdownHeadingAnchors(): string[];
  export function checkContributingE2ePaths(): string[];
  export function checkDurableDocumentReachability(): string[];
  export function checkKnowledgeIndexCompleteness(): string[];
  export function checkSkillIndexCompleteness(): string[];
  export function checkDocumentationContracts(): string[];
}

declare module "*/archive-plans.mjs" {
  export function archiveTerminalPlans(options?: { plansDir?: string }): string[];
}

declare module "*/new-plan.mjs" {
  export function safePlanName(value: string): string;
  export function planTemplate(name: string, updated: string): string;
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

declare module "*/run-e2e-route.mjs" {
  export const E2E_ROUTES: Record<string, { label: string; args: readonly string[] }>;
  export function resolveE2eRoute(route: string): { label: string; args: readonly string[] } | undefined;
}

declare module "*/test-commands.mjs" {
  export const TEST_SUITES: {
    save: readonly string[];
    tooling: readonly string[];
    shipUnit: readonly string[];
  };
  export function validateTestSuitePaths(rootDir: string, suites?: readonly string[]): string[];
}

declare module "*/test-suites.mjs" {
  export const TEST_SUITES: {
    save: readonly string[];
    tooling: readonly string[];
    shipUnit: readonly string[];
  };
  export function validateTestSuitePaths(rootDir: string, suites?: readonly string[]): string[];
}

declare module "*/compact-output.mjs" {
  export const ROUTINE_EXPOSURE_BUDGET_BYTES: number;
  export function sanitizeOutput(output: string): string;
  export function outputStats(output: string): { bytes: number; lines: number };
  export function commandExposure(options: {
    key: string;
    label: string;
    command: string;
    result: { output: string; status: number | null; elapsedMs: number };
    exposedOutput?: string;
    budgetBytes?: number | null;
  }): {
    key: string;
    label: string;
    command: string;
    status: number | null;
    durationMs: number;
    rawBytes: number;
    rawLines: number;
    exposedBytes: number;
    exposedLines: number;
    omittedBytes: number;
    omittedPercent: number;
    budgetBytes: number | null;
    overBudget: boolean;
  };
  export function firstOutputLine(output: string): string;
  export function tailOutput(output: string, maxBytes?: number): string;
}

declare module "*/measure-agent-context.mjs" {
  export const ROUTE_CONTEXT_BUDGETS: Readonly<Record<string, { preread: number; total: number }>>;
  export function measureContext(options?: {
    paths?: string[];
    docs?: string[];
    artifacts?: string[];
    outputFiles?: string[];
  }): ContextMeasurement;
  export function measureAllRoutes(): ContextMeasurement[];
}

declare module "*/context-hotspots.mjs" {
  export const ROUTINE_EXPOSURE_BUDGET_BYTES: number;
  interface CommandHotspot {
    key: string;
    label: string;
    occurrences: number;
    failures: number;
    rawBytes: number;
    exposedBytes: number;
    maxExposedBytes: number;
    overBudgetOccurrences: number;
    maxRawBytes: number;
    rawLines: number;
    avoidedPercent: number;
  }
  export function parseContextHotspotArgs(argv: string[]): {
    last: number;
    minBytes: number;
    json: boolean;
    check: boolean;
  };
  export function aggregateCommandExposures(runs: Array<Record<string, unknown>>, minBytes?: number): CommandHotspot[];
  export function buildContextHotspotReport(
    rootDir: string,
    options?: { last?: number; minBytes?: number },
  ): { generatedAt: string; inspectedRuns: number; routes: ContextMeasurement[]; commands: CommandHotspot[] };
  export function formatContextHotspotReport(report: {
    generatedAt: string;
    inspectedRuns: number;
    routes: ContextMeasurement[];
    commands: CommandHotspot[];
  }): string;
}

declare module "*/verify-changed.mjs" {
  export function main(argv?: string[]): number;
  export function formatPlan(
    plan: { paths: string[]; routes: VerificationRoute[]; commands: VerificationCommand[] },
    options?: { verbosePlan?: boolean },
  ): string;
  export function writeFailureDigest(
    directory: string,
    command: VerificationCommand,
    result: { output: string; status: number | null; elapsedMs: number },
    runId: string,
    index: number,
  ): { digestPath: string; logPath: string };
}

declare module "*/current-run.mjs" {
  export function normalizeRunId(value: unknown): string;
  export function createRunId(label?: string, options?: { now?: Date; pid?: number; suffix?: string }): string;
  export function ensureRunId(label?: string, env?: NodeJS.ProcessEnv): string;
  export function writeCurrentRun(options: {
    rootDir: string;
    runId?: string;
    status: string;
    command: string;
    artifacts?: Array<string | { path: string; role?: "primary" | "secondary" }>;
    summary?: string;
    counts?: Partial<Record<"passed" | "failed" | "skipped" | "flaky", number>>;
    commit?: string | null;
    commandExposures?: Array<{
      key: string;
      label: string;
      command: string;
      status: number | null;
      durationMs: number;
      rawBytes: number;
      rawLines: number;
      exposedBytes: number;
      exposedLines: number;
      omittedBytes: number;
      omittedPercent: number;
      budgetBytes: number | null;
      overBudget: boolean;
    }>;
    steps?: Array<{ label: string; status: "passed" | "failed" | "skipped"; durationMs: number; reason?: string }>;
    sourceDigest?: string;
  }): {
    jsonPath: string;
    markdownPath: string;
    runJsonPath: string;
    runMarkdownPath: string;
    runId: string;
  };
}

declare module "*/show-runs.mjs" {
  export function parseShowRunsArgs(argv: string[]): { last: number; status?: string };
  export function readRecentRuns(
    rootDir: string,
    options?: { last?: number; status?: string },
  ): Array<Record<string, unknown>>;
  export function formatRecentRun(rootDir: string, record: Record<string, unknown>): string;
}

declare module "*/check.mjs" {
  export function captureSourceDigest(): { head: string; hash: string };
  export function parseCheckArgs(argv: string[]): string[];
  export function runCheck(
    argv?: string[],
    options?: {
      runner?: (label: string, command: string, args: string[], env: NodeJS.ProcessEnv) => number | Promise<number>;
      captureDigest?: () => { head: string; hash: string };
    },
  ): Promise<number>;
}

declare module "*/route-hints.mjs" {
  export function routeHintForPath(filePath: string, rootDir?: string): { routes: string[]; focusedE2E: string[] };
  export function formatRouteHintLine(hint: { routes: string[]; focusedE2E: string[] }): string;
}

declare module "*/plugin.js" {
  export const alchemyPlugin: import("eslint").ESLint.Plugin;
}

declare module "*/electron-path.mjs" {
  export function platformPath(): string;
  export function getExecutablePath(relativePath?: string): string;
  export function resolveElectronExecutablePath(): string;
  export function resolveElectronExecutablePathWithMarker(): string;
  export function isElectronInstalled(): boolean;
  export function writeExecutablePathMarker(executablePath?: string): void;
  export const electronRoot: string;
  export const MIN_BINARY_BYTES: number;
  export const projectRoot: string;
}

declare module "*/git-classify.mjs" {
  export function extractSubcommand(argv: string[]): {
    subcommand: string;
    subIndex: number;
    args: string[];
  };
  export function isDestructive(parsedArgs: string[]): boolean;
}

declare module "*/audit.mjs" {
  export function parseAuditArgs(argv: string[]): {
    hasTypes: boolean;
    hasAmplification: boolean;
    hasContent: boolean;
    hasHotspots: boolean;
    hasAll: boolean;
  };
}

declare module "*/prepare-assets.mjs" {
  export function prepareAssets(): Promise<unknown>;
}

declare module "*/check-prepared-assets.mjs" {
  export function checkPreparedAssets(): Promise<void>;
}
