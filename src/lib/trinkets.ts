import { defaultTrinketEffects, isTrinketId, trinketById } from "@/lib/game-data";
import type { TrinketManifest } from "./battle/types";

export { defaultTrinketEffects };

export function computeTrinketManifest(trinketIds: readonly string[]): TrinketManifest {
  const manifest = { ...defaultTrinketEffects };
  for (const id of trinketIds) {
    if (isTrinketId(id)) Object.assign(manifest, trinketById[id].effects);
  }

  return manifest;
}

/** Read one manifest field without building the full object (last grant wins). */
export function getTrinketEffectValue<K extends keyof TrinketManifest>(
  trinketIds: readonly string[],
  key: K,
): TrinketManifest[K] {
  for (let index = trinketIds.length - 1; index >= 0; index--) {
    const id = trinketIds[index]!;
    if (!isTrinketId(id)) continue;
    const candidate = trinketById[id].effects[key];
    if (candidate !== undefined) return candidate;
  }
  return defaultTrinketEffects[key];
}

export function combineTrinketEffectIds(runBoons: readonly string[], equippedTrinketId: string | null): string[] {
  const ids = new Set(runBoons);
  if (equippedTrinketId) ids.add(equippedTrinketId);
  return [...ids];
}
