export function assetLibraryRoot(): string;
export function resolveAssetSource(source: string): string;
export function requireAssetSources<T extends { source: string; target?: string }>(
  entries: readonly T[],
  recovery?: {
    manifestPath: string;
    settingsFor: (entry: T) => Record<string, unknown>;
    selectionFor?: (entry: T) => unknown;
  },
): Promise<void>;
