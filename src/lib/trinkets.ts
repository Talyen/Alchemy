import { defaultTrinketEffects, trinketById } from "@/lib/game-data";
import type { TrinketManifest } from "./battle/types";

export { defaultTrinketEffects };

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
