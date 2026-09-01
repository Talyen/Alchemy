const CARD_ID_REMAPS: Record<string, string> = {
  "sunder-armor": "sunder",
};

const CARD_ID_REMAPS_V2: Record<string, string> = {
  roulette: "roll-the-dice",
};

export const REMAPS_ALL: Record<string, string> = {
  ...CARD_ID_REMAPS,
  ...CARD_ID_REMAPS_V2,
};

function remapContentTree(value: unknown, remapId: (id: string) => string): unknown {
  if (Array.isArray(value)) return value.map((item) => remapContentTree(item, remapId));
  if (value && typeof value === "object") {
    const next: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (key === "id" && typeof nested === "string") {
        next[key] = remapId(nested);
      } else {
        next[key] = remapContentTree(nested, remapId);
      }
    }
    return next;
  }
  if (typeof value === "string") return remapId(value);
  return value;
}

function migrateContentV1ToV2(parsed: Record<string, unknown>): Record<string, unknown> {
  return remapContentTree(parsed, (id) => CARD_ID_REMAPS[id] ?? id) as Record<string, unknown>;
}

function migrateContentV2ToV3(parsed: Record<string, unknown>): Record<string, unknown> {
  return remapContentTree(parsed, (id) => CARD_ID_REMAPS_V2[id] ?? id) as Record<string, unknown>;
}

export function migrateContentToCurrentVersion(
  parsed: Record<string, unknown>,
  fromVersion: number,
): Record<string, unknown> {
  if (fromVersion >= 3) return parsed;
  if (fromVersion < 2) {
    return migrateContentV2ToV3(migrateContentV1ToV2(parsed));
  }
  return migrateContentV2ToV3(parsed);
}
