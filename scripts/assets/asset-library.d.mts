export function assetLibraryRoot(): string;
export function resolveAssetSource(source: string): string;
export function requireAssetSources(entries: ReadonlyArray<{ source: string }>): Promise<void>;
