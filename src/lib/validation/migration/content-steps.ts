// Content-id remaps for persisted saves. Card/trinket id changes bump contentVersion.
const CARD_ID_REMAPS: Record<string, string> = {
  "sunder-armor": "sunder",
};

function remapContentTree(value: unknown, remapId: (id: string) => string): unknown {
  if (typeof value === "string") return remapId(value);
  if (Array.isArray(value)) return value.map((item) => remapContentTree(item, remapId));
  if (value && typeof value === "object") {
    const next: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      next[key] = key === "id" && typeof nested === "string" ? remapId(nested) : remapContentTree(nested, remapId);
    }
    return next;
  }
  return value;
}

export function migrateContentV1ToV2(parsed: Record<string, unknown>): Record<string, unknown> {
  return remapContentTree(parsed, (id) => CARD_ID_REMAPS[id] ?? id) as Record<string, unknown>;
}

// Content version 2 -> 3: Roulette renamed to Roll the Dice (art + title).
const CARD_ID_REMAPS_V2: Record<string, string> = {
  roulette: "roll-the-dice",
};

export function migrateContentV2ToV3(parsed: Record<string, unknown>): Record<string, unknown> {
  return remapContentTree(parsed, (id) => CARD_ID_REMAPS_V2[id] ?? id) as Record<string, unknown>;
}
