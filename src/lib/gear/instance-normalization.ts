import { normalizeAffixRolls } from "./affixes";
import { gearAffixCatalog } from "./affix-catalog";
import { GEAR_AFFIX_COUNT } from "@/lib/game-constants";
import { gearDefinitions } from "./definitions";
import type { GearInstance } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function normalizeGearInstance(raw: unknown): GearInstance | null {
  if (!isRecord(raw)) return null;

  const instanceId = typeof raw.instanceId === "string" ? raw.instanceId : undefined;
  const definitionId = typeof raw.definitionId === "string" ? raw.definitionId : undefined;
  const definition =
    definitionId && Object.hasOwn(gearDefinitions, definitionId) ? gearDefinitions[definitionId] : undefined;
  if (!instanceId || !definitionId || !definition) return null;

  // Unique affixes resolve canonically at read time; stored rolls are dropped
  // so older saves carrying them converge on the catalog without a migration.
  if (definition.rarity === "unique") {
    return { instanceId, definitionId, affixes: [] };
  }

  const seen = new Set<string>();
  const affixes = normalizeAffixRolls(Array.isArray(raw.affixes) ? raw.affixes : undefined, definition.rarity)
    .filter((roll) => {
      if (seen.has(roll.id) || gearAffixCatalog[roll.id].uniqueOnly) return false;
      seen.add(roll.id);
      return true;
    })
    .slice(0, GEAR_AFFIX_COUNT[definition.rarity ?? "basic"].max);
  return {
    instanceId,
    definitionId,
    affixes,
  };
}
