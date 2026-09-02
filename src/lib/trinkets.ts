import { defaultTrinketEffects, trinketLibrary } from "@/lib/game-data";
import type { TrinketManifest } from "./battle/types";

export { defaultTrinketEffects };

const DEFAULT_TRINKET_MANIFEST_KEYS = Object.keys(defaultTrinketEffects) as Array<keyof TrinketManifest>;

const trinketEffects: Record<string, Partial<TrinketManifest>> = Object.fromEntries(
  trinketLibrary.map((entry) => [entry.id, entry.effects]),
);

export function computeTrinketManifest(trinketIds: readonly string[]): TrinketManifest {
  const manifest = { ...defaultTrinketEffects };
  if (trinketIds.length === 0) return manifest;

  for (const id of trinketIds) {
    const effects = trinketEffects[id];
    if (effects) Object.assign(manifest, effects);
  }

  return manifest;
}

export function combineTrinketEffectIds(runBoons: readonly string[], equippedTrinketId: string | null): string[] {
  return [...new Set(equippedTrinketId ? [...runBoons, equippedTrinketId] : runBoons)];
}

export function isDefaultTrinketManifest(manifest: TrinketManifest): boolean {
  return DEFAULT_TRINKET_MANIFEST_KEYS.every((key) => manifest[key] === defaultTrinketEffects[key]);
}
