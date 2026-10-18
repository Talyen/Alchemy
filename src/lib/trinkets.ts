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
  let value = defaultTrinketEffects[key];
  for (const id of trinketIds) {
    if (!isTrinketId(id)) continue;
    const candidate = trinketById[id].effects[key];
    if (candidate !== undefined) value = candidate;
  }
  return value;
}

export function combineTrinketEffectIds(runBoons: readonly string[], equippedTrinketId: string | null): string[] {
  if (!equippedTrinketId) return [...new Set(runBoons)];
  const ids = new Set(runBoons);
  ids.add(equippedTrinketId);
  return [...ids];
}
