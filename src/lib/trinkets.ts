import { defaultTrinketEffects, trinketById } from "@/lib/game-data";
import type { TrinketManifest } from "./battle/types";

export { defaultTrinketEffects };

const DEFAULT_TRINKET_MANIFEST_KEYS = Object.keys(defaultTrinketEffects) as Array<keyof TrinketManifest>;

export function computeTrinketManifest(trinketIds: readonly string[]): TrinketManifest {
  const manifest = { ...defaultTrinketEffects };
  for (const id of trinketIds) {
    if (Object.hasOwn(trinketById, id)) Object.assign(manifest, trinketById[id]?.effects);
  }

  return manifest;
}

export function combineTrinketEffectIds(runBoons: readonly string[], equippedTrinketId: string | null): string[] {
  return [...new Set(equippedTrinketId ? [...runBoons, equippedTrinketId] : runBoons)];
}

export function isDefaultTrinketManifest(manifest: TrinketManifest): boolean {
  return DEFAULT_TRINKET_MANIFEST_KEYS.every((key) => manifest[key] === defaultTrinketEffects[key]);
}
