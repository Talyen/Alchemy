// Save-load migration for legacy gear definition IDs and legacy affix formats (affixIds, modifiers).
// Pure migration helper — used during save data parsing so domain code operates only on canonical shapes.

const LEGACY_GEAR_DEFINITION_IDS: Record<string, string> = {
  "leather-hood-basic": "leather-helm-basic",
  "great-axe-basic": "double-axe-basic",
  "great-axe-astral": "double-axe-astral",
  "great-mace-basic": "maul-basic",
  "great-mace-astral": "maul-astral",
  "great-sword-basic": "greatsword-basic",
  "great-sword-astral": "greatsword-astral",
  "hand-axe-basic": "hatchet-basic",
  "hand-axe-astral": "hatchet-astral",
  "long-sword-basic": "longsword-basic",
  "long-sword-astral": "longsword-astral",
  "sword-basic": "longsword-basic",
  "sword-astral": "longsword-astral",
  "short-sword-basic": "shortsword-basic",
  "short-sword-astral": "shortsword-astral",
  "gladius-basic": "shortsword-basic",
  "shortsword-basic": "shortsword-basic",
  "shortsword-astral": "shortsword-astral",
  "long-bow-basic": "longbow-basic",
  "long-bow-astral": "longbow-astral",
  "short-bow-basic": "shortbow-basic",
  "short-bow-astral": "shortbow-astral",
  "leather-shield-basic": "leather-buckler-basic",
  "leather-shield-astral": "leather-buckler-astral",
  "plate-shield-basic": "kite-shield-basic",
  "plate-shield-astral": "kite-shield-astral",
};

const LEGACY_AFFIX_MAP: Record<string, string> = {
  "flat-physical-1": "flat-physical",
  "flat-stun-1": "flat-stun",
  "flat-holy-1": "flat-holy",
  "flat-burn-1": "flat-burn",
  "flat-poison-1": "flat-poison",
  "flat-bleed-1": "flat-bleed",
  "flat-freeze-1": "flat-freeze",
  "flat-nature-1": "flat-nature",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function migrateLegacyGearInstance(raw: unknown): Record<string, unknown> | unknown {
  if (!isRecord(raw)) return raw;

  const rawDefinitionId = typeof raw.definitionId === "string" ? raw.definitionId : undefined;
  const definitionId = rawDefinitionId
    ? (LEGACY_GEAR_DEFINITION_IDS[rawDefinitionId] ?? rawDefinitionId)
    : raw.definitionId;

  let affixes: Array<{ id: string; value: number }> | undefined = undefined;

  if (Array.isArray(raw.affixes) && raw.affixes.length > 0) {
    affixes = (raw.affixes as Array<Record<string, unknown>>).flatMap((entry) => {
      if (!isRecord(entry) || typeof entry.id !== "string" || typeof entry.value !== "number") return [];
      const id = LEGACY_AFFIX_MAP[entry.id] ?? entry.id;
      return [{ id, value: entry.value }];
    });
  } else if (Array.isArray(raw.affixIds) && raw.affixIds.length > 0) {
    affixes = (raw.affixIds as string[]).flatMap((legacyId) => {
      if (typeof legacyId !== "string") return [];
      const id = LEGACY_AFFIX_MAP[legacyId] ?? legacyId;
      return [{ id, value: 1 }];
    });
  } else if (Array.isArray(raw.modifiers) && raw.modifiers.length > 0) {
    const rolls: Array<{ id: string; value: number }> = [];
    for (const modifier of raw.modifiers as Array<Record<string, unknown>>) {
      if (
        isRecord(modifier) &&
        modifier.kind === "flatPhysicalDamage" &&
        typeof modifier.value === "number" &&
        Number.isFinite(modifier.value)
      ) {
        const count = Math.max(0, Math.round(modifier.value));
        for (let i = 0; i < count; i += 1) {
          rolls.push({ id: "flat-physical", value: 1 });
        }
      }
    }
    affixes = rolls;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { affixIds: _affixIds, modifiers: _modifiers, ...rest } = raw;

  return {
    ...rest,
    definitionId,
    ...(affixes ? { affixes } : {}),
  };
}
