import { forEachNormalizedAffixRoll } from "./affixes";
import { GEAR_AFFIX_COUNT } from "@/lib/game-constants";
import { isRecord } from "@/lib/utils";
import { gearDefinitions } from "./definitions";
import type { GearAffixRoll, GearInstance } from "./types";

export function normalizeGearInstance(raw: unknown): GearInstance | null {
  if (!isRecord(raw)) return null;

  const instanceId = typeof raw.instanceId === "string" ? raw.instanceId : undefined;
  const definitionId = typeof raw.definitionId === "string" ? raw.definitionId : undefined;
  const definition = definitionId ? gearDefinitions[definitionId] : undefined;
  if (!instanceId || !definitionId || !definition) return null;

  // Unique affixes resolve canonically at read time; stored rolls are dropped
  // so older saves carrying them converge on the catalog without a migration.
  if (definition.rarity === "unique") {
    return { instanceId, definitionId, affixes: [] };
  }

  const seen = new Set<string>();
  const affixes: GearAffixRoll[] = [];
  const limit = GEAR_AFFIX_COUNT[definition.rarity].max;
  forEachNormalizedAffixRoll(
    Array.isArray(raw.affixes) ? raw.affixes : undefined,
    definition.rarity,
    (affix, value) => {
      if (affixes.length >= limit || seen.has(affix.id) || affix.uniqueOnly) return;
      seen.add(affix.id);
      affixes.push({ id: affix.id, value });
    },
  );
  return {
    instanceId,
    definitionId,
    affixes,
  };
}
