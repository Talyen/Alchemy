export function computeSyncedChangelog(existingContent: string, rootDir?: string): string;

export function syncChangelog(options?: { root?: string; check?: boolean }): Promise<string>;
