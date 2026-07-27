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
  export function substituteSteamVdf(template: string, values: Record<string, string>): string;
  export function writeSteamBuildVdfs(
    root: string,
    env: { STEAM_APP_ID: string; STEAM_DEPOT_ID: string; [key: string]: string },
  ): { appPath: string; depotPath: string; buildDir: string };
}

declare module "*/sync-changelog.mjs" {
  export function syncChangelog(root: { root: string }): string;
  export function computeSyncedChangelog(existingContent: string, rootDir?: string): string;
}

declare module "../../scripts/lib/steam-vdf.mjs" {
  export function substituteSteamVdf(template: string, values: Record<string, string>): string;
  export function writeSteamBuildVdfs(
    root: string,
    env: { STEAM_APP_ID: string; STEAM_DEPOT_ID: string; [key: string]: string },
  ): { appPath: string; depotPath: string; buildDir: string };
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
