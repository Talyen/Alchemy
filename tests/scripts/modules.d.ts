declare module "../../scripts/lib/patch-notes-core.mjs" {
  export function computePatchNotes(opts: { root: string }): {
    entries: { type: string; scope: string; description: string }[];
    unreleased: { type: string; scope: string; description: string }[];
  };
}

declare module "../../scripts/lib/steam-vdf.mjs" {
  export function substituteSteamVdf(template: string, values: Record<string, string>): string;
  export function writeSteamBuildVdfs(root: string, version: string): void;
}

declare module "../../scripts/sync-changelog.mjs" {
  export function syncChangelog(root: { root: string }): string;
  export function computeSyncedChangelog(root: { root: string }): {
    unreleased: { type: string; scope: string; description: string }[];
  };
}
