import type { StaticAssetEntry } from "./asset-manifest.mjs";

type ArtPreset = Pick<StaticAssetEntry, "width" | "quality" | "lossless">;

export function artGroup(
  options: { folder: string; preset: ArtPreset; requiresTransparency?: boolean },
  entries: readonly (readonly [source: string, target: string, preset?: ArtPreset])[],
): StaticAssetEntry[];
