import { gearArtByDefinitionId } from "@/lib/game-data";
import {
  buildEligibleAffixPool,
  gearBaseItems,
  gearDefinitionId,
  gearDefinitionList,
  gearDefinitions,
  gearAffixCatalog,
  GEAR_AFFIX_IDS,
  GEAR_EFFECT_KEYS,
  GEAR_RARITIES,
} from "@/lib/gear";
import { GEAR_AFFIX_COUNT } from "@/lib/game-constants";
import { GearDefinitionContentSchema, GearAffixContentSchema } from "./schemas";
import { addDuplicateIssues, collectSchemaIssues, validateArt } from "./utils";
import type { createCollector } from "./utils";

function validateGearAffixIds(collector: ReturnType<typeof createCollector>): void {
  const affixIds = Object.keys(gearAffixCatalog);
  if (GEAR_AFFIX_IDS.length !== new Set(GEAR_AFFIX_IDS).size) {
    collector.error("gear", "GEAR_AFFIX_IDS", "Gear affix id list contains duplicates");
  }
  if (GEAR_AFFIX_IDS.length !== affixIds.length) {
    collector.error("gear", "gearAffixCatalog", "Gear affix catalog has a missing or duplicate row");
  }
  if (GEAR_EFFECT_KEYS.length !== new Set(GEAR_EFFECT_KEYS).size) {
    collector.error("gear", "GEAR_EFFECT_KEYS", "Gear effect key list contains duplicates");
  }
  for (const id of GEAR_AFFIX_IDS) {
    if (!(gearAffixCatalog as Record<string, unknown>)[id])
      collector.error("gear", id, "Affix id is missing from gearAffixCatalog");
  }
}

function validateBaseItems(collector: ReturnType<typeof createCollector>): void {
  for (const baseItemId of Object.keys(gearBaseItems)) {
    for (const rarity of ["basic", "astral"] as const) {
      const definitionId = gearDefinitionId(baseItemId, rarity);
      if (!gearDefinitions[definitionId])
        collector.error("gear", definitionId, "Missing generated gear definition for base item rarity");
    }
  }
}

function validateGearDefinitions(collector: ReturnType<typeof createCollector>): void {
  for (const definition of gearDefinitionList) {
    collectSchemaIssues(GearDefinitionContentSchema, definition, "gear", definition.id, collector.error);
    validateArt("gear", definition.id, definition.art, collector.error, collector.warning);
    if (definition.rarity !== "unique" && !gearArtByDefinitionId[definition.id])
      collector.error("art", definition.id, "Missing generated gear art mapping");
    const minAffixes = definition.rarity ? GEAR_AFFIX_COUNT[definition.rarity].min : 0;
    if (definition.rarity === "unique") continue;
    if (!definition.rarity) continue;

    const eligibleAffixes = buildEligibleAffixPool(definition);
    if (eligibleAffixes.length < minAffixes)
      collector.error(
        "gear",
        definition.id,
        `Eligible affix pool ${eligibleAffixes.length} is smaller than minimum ${minAffixes}`,
      );
  }
}

function validateGearAffixes(collector: ReturnType<typeof createCollector>): void {
  const usedEffectKeys = new Set<string>();
  for (const affix of Object.values(gearAffixCatalog)) {
    collectSchemaIssues(GearAffixContentSchema, affix, "gear", affix.id, collector.error);
    usedEffectKeys.add(affix.effectKey);
    for (const rarity of GEAR_RARITIES) {
      const roll = affix.roll[rarity];
      if (roll.min > roll.max) collector.warning("balance", affix.id, `${rarity} roll min is greater than max`);
    }
  }
  for (const key of GEAR_EFFECT_KEYS) {
    if (!usedEffectKeys.has(key)) collector.error("gear", key, "Gear effect key is not referenced by an affix");
  }
}

export function validateGear(collector: ReturnType<typeof createCollector>): void {
  const baseItems = Object.values(gearBaseItems);
  addDuplicateIssues(
    baseItems.map((item) => item.id),
    "gear",
    "gear base item id",
    collector.error,
  );
  addDuplicateIssues(
    gearDefinitionList.map((d) => d.id),
    "gear",
    "gear definition id",
    collector.error,
  );

  validateGearAffixIds(collector);
  validateBaseItems(collector);
  validateGearDefinitions(collector);
  validateGearAffixes(collector);
}
