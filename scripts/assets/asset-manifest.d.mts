export interface StaticAssetEntry {
  readonly source: string;
  readonly target: string;
  readonly width: number;
  readonly quality: number;
  readonly requiresTransparency?: boolean;
}

export declare const staticAssets: readonly StaticAssetEntry[];

export declare function validateAssetRegistry(
  entries: readonly unknown[],
  options?: { sourceDir?: string },
): Promise<unknown>;
