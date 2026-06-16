import type { RawSaveData } from "./types";

const LEGACY_BOON_CONTENT_IDS: Record<string, string> = {
  "boon-hoarder": "trinket-hoarder",
  "wish-boon": "wish-trinket",
  "leech-boon-siphon": "leech-trinket-siphon",
};

/** Remaps boon-era content IDs to trinket equivalents. Exported for nested snapshot migrations. */
export function remapLegacyBoonContentId(id: string): string {
  return LEGACY_BOON_CONTENT_IDS[id] ?? id;
}

function remapTalentId(id: string): string {
  return remapLegacyBoonContentId(id);
}

function remapDiscoveredTrinketIds(parsed: RawSaveData): string[] | undefined {
  if (Array.isArray(parsed.discoveredTrinketIds)) {
    return (parsed.discoveredTrinketIds as string[]).map(remapTalentId);
  }
  if (Array.isArray(parsed.discoveredBoonIds)) {
    return (parsed.discoveredBoonIds as string[]).map(remapTalentId);
  }
  return undefined;
}

function remapUnlockedTalents(record: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!record || typeof record !== "object") return {};
  const next: Record<string, unknown> = {};
  for (const [keyword, value] of Object.entries(record)) {
    if (!Array.isArray(value)) {
      next[keyword] = value;
      continue;
    }
    next[keyword] = value.filter((id): id is string => typeof id === "string").map(remapTalentId);
  }
  return next;
}

/** Remaps boon-era content IDs to trinket equivalents (contentVersion 2). */
export function migrateContentV2(parsed: RawSaveData): RawSaveData {
  const discoveredTrinketIds = remapDiscoveredTrinketIds(parsed);
  const next: RawSaveData = {
    ...parsed,
    contentVersion: 2,
    unlockedTalents: remapUnlockedTalents(parsed.unlockedTalents as Record<string, unknown> | undefined),
  };
  if (discoveredTrinketIds) {
    next.discoveredTrinketIds = discoveredTrinketIds;
    delete next.discoveredBoonIds;
  }
  return next;
}
