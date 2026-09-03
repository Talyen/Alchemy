const CONTENT_ID_REMAPS_BY_VERSION: Array<{ toVersion: number; remaps: Record<string, string> }> = [
  { toVersion: 2, remaps: { "sunder-armor": "sunder" } },
  { toVersion: 3, remaps: { roulette: "roll-the-dice" } },
];

function isCardIdPosition(key: string): boolean {
  return key === "id" || key.endsWith("Id") || key.endsWith("Ids");
}

function remapContentIds(value: unknown, remaps: Record<string, string>, idPosition: boolean): unknown {
  if (Array.isArray(value)) return value.map((item) => remapContentIds(item, remaps, idPosition));
  if (value && typeof value === "object") {
    const next: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      next[key] = remapContentIds(nested, remaps, isCardIdPosition(key));
    }
    return next;
  }
  if (typeof value === "string") return idPosition ? (remaps[value] ?? value) : value;
  return value;
}

export function migrateContentToCurrentVersion(
  parsed: Record<string, unknown>,
  fromVersion: number,
): Record<string, unknown> {
  let next = parsed;
  for (const step of CONTENT_ID_REMAPS_BY_VERSION) {
    if (fromVersion < step.toVersion) next = remapContentIds(next, step.remaps, false) as Record<string, unknown>;
  }
  return next;
}
