import { normalizeAffixRolls } from "./affixes";
import { gearAffixCatalog } from "./affix-catalog";
import { GEAR_AFFIX_COUNT } from "@/lib/game-constants";
import { isRecord } from "@/lib/utils";
import { gearDefinitions } from "./definitions";
import type { GearInstance } from "./types";

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
  const affixes = normalizeAffixRolls(Array.isArray(raw.affixes) ? raw.affixes : undefined, definition.rarity);
  let kept = 0;
  for (const roll of affixes) {
    if (seen.has(roll.id) || gearAffixCatalog[roll.id].uniqueOnly) continue;
    seen.add(roll.id);
    affixes[kept++] = roll;
    if (kept === GEAR_AFFIX_COUNT[definition.rarity].max) break;
  }
  affixes.length = kept;
  return {
    instanceId,
    definitionId,
    affixes,
  };
}
