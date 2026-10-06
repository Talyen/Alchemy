export function optimizeAssets(options?: { check?: boolean }): Promise<{ ok: boolean; error?: string }>;

export function artTransformSettings(asset: {
  width: number;
  quality: number;
  requiresTransparency?: boolean;
}): Record<string, unknown>;
