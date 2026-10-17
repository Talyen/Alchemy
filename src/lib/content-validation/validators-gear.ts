import { gearArtByDefinitionId } from "@/lib/game-data";
import {
  buildEligibleAffixPool,
  gearBaseItems,
  gearDefinitionId,
  gearDefinitionList,
  gearDefinitions,
  missingGearArtDefinitionIds,
  gearAffixCatalog,
  uniqueItemList,
  GEAR_RARITIES,
} from "@/lib/gear";
import { GEAR_AFFIX_COUNT } from "@/lib/game-constants";
import { GearDefinitionContentSchema, GearAffixContentSchema } from "./schemas";
import { addDuplicateIssues, collectSchemaIssues, validateLibraryBasics } from "./utils";
import type { Collector } from "./utils";

function validateBaseItems(collector: Collector): void {
  for (const baseItemId of Object.keys(gearBaseItems)) {
    for (const rarity of ["basic", "astral"] as const) {
      const definitionId = gearDefinitionId(baseItemId, rarity);
      if (!gearDefinitions[definitionId])
        collector.error("gear", definitionId, "Missing generated gear definition for base item rarity");
    }
  }
}

function validateGearDefinitions(collector: Collector): Set<string> {
  const reachableAffixes = new Set<string>();
  for (const id of missingGearArtDefinitionIds)
    collector.error("gear", id, "Gear definition uses missing-art fallback");
  for (const definition of gearDefinitionList) {
    if (definition.rarity !== "unique" && !gearArtByDefinitionId[definition.id])
      collector.error("gear", definition.id, "Missing generated gear art mapping");
    if (definition.rarity === "unique") continue;

    const minAffixes = GEAR_AFFIX_COUNT[definition.rarity].min;
    const eligibleAffixes = buildEligibleAffixPool(definition);
    for (const affix of eligibleAffixes) reachableAffixes.add(affix.id);
    if (eligibleAffixes.length < minAffixes)
      collector.error(
        "gear",
        definition.id,
        `Eligible affix pool ${eligibleAffixes.length} is smaller than minimum ${minAffixes}`,
      );
  }
  return reachableAffixes;
}

function validateGearAffixes(collector: Collector, reachableAffixes: ReadonlySet<string>): void {
  addDuplicateIssues(
    Object.values(gearAffixCatalog).map((affix) => affix.name),
    "gear",
    "gear affix name",
    collector.error,
  );
  for (const affix of Object.values(gearAffixCatalog)) {
    collectSchemaIssues(GearAffixContentSchema, affix, "gear", affix.id, collector.error);
    for (const rarity of GEAR_RARITIES) {
      const roll = affix.roll[rarity];
      if (roll.min > roll.max) collector.error("gear", affix.id, `${rarity} roll min is greater than max`);
    }
    if (affix.uniqueOnly && GEAR_RARITIES.some((rarity) => affix.roll[rarity].min !== affix.roll[rarity].max))
      collector.error("gear", affix.id, "Unique-only affix must have fixed rolls at every rarity");
    if (!affix.uniqueOnly && !reachableAffixes.has(affix.id))
      collector.error("gear", affix.id, "Ordinary affix is not reachable on Basic or Astral gear");
  }
}

function validateUniqueItems(collector: Collector): void {
  addDuplicateIssues(
    uniqueItemList.map((unique) => unique.id),
    "gear",
    "unique item id",
    collector.error,
  );
  const baseItemIds = new Set(Object.keys(gearBaseItems));
  const seenBases = new Set<string>();
  const seenSignatures = new Set<string>();
  for (const unique of uniqueItemList) {
    if (!Object.hasOwn(gearDefinitions, unique.id))
      collector.error("gear", unique.id, "Missing generated gear definition for unique item");
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
    const signature = Object.hasOwn(gearAffixCatalog, unique.signatureAffix.id)
      ? gearAffixCatalog[unique.signatureAffix.id]
      : undefined;
    if (!signature?.uniqueOnly) {
      collector.error("gear", unique.id, `Signature ${unique.signatureAffix.id} must be uniqueOnly`);
    }
    if (signature && unique.signatureAffix.value !== signature.roll.unique.max)
      collector.error(
        "gear",
        unique.id,
        `Signature ${unique.signatureAffix.id} must roll the unique maximum (${signature.roll.unique.max})`,
      );
    if (unique.supportingAffixes.length !== 3) {
      collector.error("gear", unique.id, "Unique must have exactly three supporting affixes");
    }
    addDuplicateIssues(
      unique.supportingAffixes.map((affix) => affix.id),
      "gear",
      "supporting affix",
      (_area, _id, message) => collector.error("gear", unique.id, message),
    );
    for (const supporting of unique.supportingAffixes) {
      if (!Object.hasOwn(gearAffixCatalog, supporting.id)) {
        collector.error("gear", unique.id, `Unknown supporting affix ${supporting.id}`);
        continue;
      }
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

export function validateGear(collector: Collector): void {
  const baseItems = Object.values(gearBaseItems);
  addDuplicateIssues(
    baseItems.map((item) => item.id),
    "gear",
    "gear base item id",
    collector.error,
  );
  validateLibraryBasics(collector, {
    area: "gear",
    items: gearDefinitionList,
    schema: GearDefinitionContentSchema,
    artOf: (definition) => definition.art,
    idLabel: "gear definition id",
  });

  validateBaseItems(collector);
  const reachableAffixes = validateGearDefinitions(collector);
  validateGearAffixes(collector, reachableAffixes);
  validateUniqueItems(collector);
}
