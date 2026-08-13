// Content-id remaps for persisted saves. Card/trinket id changes bump contentVersion.
const CARD_ID_REMAPS: Record<string, string> = {
  "sunder-armor": "sunder",
};

function remapCardId(id: string): string {
  return CARD_ID_REMAPS[id] ?? id;
}

function remapContentIds(value: unknown): unknown {
  if (typeof value === "string") return remapCardId(value);
  if (Array.isArray(value)) return value.map(remapContentIds);
  if (value && typeof value === "object") {
    const next: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      next[key] = key === "id" && typeof nested === "string" ? remapCardId(nested) : remapContentIds(nested);
    }
    return next;
  }
  return value;
}

export function migrateContentV1ToV2(parsed: Record<string, unknown>): Record<string, unknown> {
  return remapContentIds(parsed) as Record<string, unknown>;
}
