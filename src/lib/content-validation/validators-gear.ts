import { gearArtByDefinitionId } from "@/lib/game-data";
import {
  buildEligibleAffixPool,
  gearBaseItems,
  gearDefinitionId,
  gearDefinitionList,
  gearDefinitions,
  gearAffixCatalog,
  uniqueItemList,
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
      collector.error("gear", definition.id, "Missing generated gear art mapping");
    if (definition.rarity === "unique" || !definition.rarity) continue;

    const minAffixes = GEAR_AFFIX_COUNT[definition.rarity].min;
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

function validateUniqueItems(collector: ReturnType<typeof createCollector>): void {
  const baseItemIds = new Set(Object.keys(gearBaseItems));
  const seenBases = new Set<string>();
  const seenSignatures = new Set<string>();
  for (const unique of uniqueItemList) {
    if (!baseItemIds.has(unique.baseItemId)) {
      collector.error("gear", unique.id, `Unique references unknown base item ${unique.baseItemId}`);
    }
    if (seenBases.has(unique.baseItemId)) {
      collector.error("gear", unique.id, `Duplicate unique for base item ${unique.baseItemId}`);
    }
    seenBases.add(unique.baseItemId);
    if (seenSignatures.has(unique.signatureAffix.id)) {
      collector.error("gear", unique.id, `Duplicate unique signature ${unique.signatureAffix.id}`);
    }
    seenSignatures.add(unique.signatureAffix.id);
    const signature = gearAffixCatalog[unique.signatureAffix.id];
    if (!signature?.uniqueOnly) {
      collector.error("gear", unique.id, `Signature ${unique.signatureAffix.id} must be uniqueOnly`);
    }
    if (unique.supportingAffixes.length !== 3) {
      collector.error("gear", unique.id, "Unique must have exactly three supporting affixes");
    }
    for (const supporting of unique.supportingAffixes) {
      const def = gearAffixCatalog[supporting.id];
      if (def?.uniqueOnly) {
        collector.error("gear", unique.id, `Supporting affix ${supporting.id} must not be uniqueOnly`);
      }
      if (def && supporting.value !== def.roll.unique.max) {
        collector.error(
          "gear",
          unique.id,
          `Supporting affix ${supporting.id} must roll the unique maximum (${def.roll.unique.max})`,
        );
      }
    }
  }
  for (const baseItemId of baseItemIds) {
    if (!seenBases.has(baseItemId)) {
      collector.error("gear", baseItemId, "Base item has no unique item");
    }
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
  validateUniqueItems(collector);
}
