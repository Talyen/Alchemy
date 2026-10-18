import { gearArtByDefinitionId } from "@/lib/game-data";
import {
  buildEligibleAffixPool,
  gearBaseItems,
  gearDefinitionId,
  gearDefinitionList,
  gearDefinitions,
  gearAffixCatalog,
  uniqueItemList,
  GEAR_RARITIES,
  type GearAffixDefinition,
  type GearBaseItemDefinition,
  type GearDefinition,
  type UniqueItemDefinition,
} from "@/lib/gear";
import { GEAR_AFFIX_COUNT } from "@/lib/game-constants";
import { GearDefinitionContentSchema, GearAffixContentSchema } from "./schemas";
import { addDuplicateIssues, collectSchemaIssues, validateLibraryBasics } from "./utils";
import type { Collector } from "./utils";

// Injectable catalogs keep tests free of module mocks and global mutation:
// production passes nothing and validates the live libraries.
export interface GearValidationData {
  readonly baseItems?: Record<string, GearBaseItemDefinition>;
  readonly definitions?: Record<string, GearDefinition>;
  readonly definitionList?: readonly GearDefinition[];
  readonly affixCatalog?: Record<string, GearAffixDefinition>;
  readonly uniques?: readonly UniqueItemDefinition[];
  readonly eligibleAffixesFor?: (definition: GearDefinition) => readonly GearAffixDefinition[];
}

type ResolvedGearData = Required<GearValidationData>;

function resolveGearData(data: GearValidationData): ResolvedGearData {
  return {
    baseItems: data.baseItems ?? gearBaseItems,
    definitions: data.definitions ?? gearDefinitions,
    definitionList: data.definitionList ?? gearDefinitionList,
    affixCatalog: data.affixCatalog ?? gearAffixCatalog,
    uniques: data.uniques ?? uniqueItemList,
    eligibleAffixesFor: data.eligibleAffixesFor ?? buildEligibleAffixPool,
  };
}

function validateBaseItems(collector: Collector, data: ResolvedGearData): void {
  for (const baseItemId of Object.keys(data.baseItems)) {
    for (const rarity of ["basic", "astral"] as const) {
      const definitionId = gearDefinitionId(baseItemId, rarity);
      if (!data.definitions[definitionId])
        collector.error("gear", definitionId, "Missing generated gear definition for base item rarity");
    }
  }
}

function validateGearDefinitions(collector: Collector, data: ResolvedGearData): Set<string> {
  const reachableAffixes = new Set<string>();
  for (const definition of data.definitionList) {
    // Unique definitions intentionally reuse their base item's Astral art, so
    // only ordinary definitions need a barrel entry of their own. A missing
    // base entry is already an error on that base's own definition.
    if (definition.rarity !== "unique" && !gearArtByDefinitionId[definition.id])
      collector.error("gear", definition.id, "Missing generated gear art mapping");
    if (definition.rarity === "unique") continue;

    const minAffixes = GEAR_AFFIX_COUNT[definition.rarity].min;
    const eligibleAffixes = data.eligibleAffixesFor(definition);
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

function validateGearAffixes(
  collector: Collector,
  data: ResolvedGearData,
  reachableAffixes: ReadonlySet<string>,
): void {
  const affixes = Object.values(data.affixCatalog);
  addDuplicateIssues(
    affixes.map((affix) => affix.name),
    "gear",
    "gear affix name",
    collector,
  );
  for (const affix of affixes) {
    collectSchemaIssues(GearAffixContentSchema, affix, "gear", affix.id, collector);
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

function validateUniqueItems(collector: Collector, data: ResolvedGearData): void {
  addDuplicateIssues(
    data.uniques.map((unique) => unique.id),
    "gear",
    "unique item id",
    collector,
  );
  const baseItemIds = new Set(Object.keys(data.baseItems));
  const seenBases = new Set<string>();
  const seenSignatures = new Set<string>();
  for (const unique of data.uniques) {
    if (!Object.hasOwn(data.definitions, unique.id))
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
    // Prototype-safe lookup: supporting ids come from content data and the
    // suite probes dunder names like "constructor".
    const signature = Object.hasOwn(data.affixCatalog, unique.signatureAffix.id)
      ? data.affixCatalog[unique.signatureAffix.id]
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
    const supportingIds = unique.supportingAffixes.map((affix) => affix.id);
    const duplicateSupporting = supportingIds.find((id, index) => supportingIds.indexOf(id) !== index);
    if (duplicateSupporting !== undefined)
      collector.error("gear", unique.id, `Duplicate supporting affix: ${duplicateSupporting}`);
    for (const supporting of unique.supportingAffixes) {
      const def = Object.hasOwn(data.affixCatalog, supporting.id) ? data.affixCatalog[supporting.id] : undefined;
      if (!def) {
        collector.error("gear", unique.id, `Unknown supporting affix ${supporting.id}`);
        continue;
      }
      if (def.uniqueOnly) {
        collector.error("gear", unique.id, `Supporting affix ${supporting.id} must not be uniqueOnly`);
      }
      if (supporting.value !== def.roll.unique.max) {
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

export function validateGear(collector: Collector, data: GearValidationData = {}): void {
  const resolved = resolveGearData(data);
  const baseItems = Object.values(resolved.baseItems);
  addDuplicateIssues(
    baseItems.map((item) => item.id),
    "gear",
    "gear base item id",
    collector,
  );
  validateLibraryBasics(collector, {
    area: "gear",
    items: resolved.definitionList,
    schema: GearDefinitionContentSchema,
    artOf: (definition) => definition.art,
    idLabel: "gear definition id",
  });

  validateBaseItems(collector, resolved);
  const reachableAffixes = validateGearDefinitions(collector, resolved);
  validateGearAffixes(collector, resolved, reachableAffixes);
  validateUniqueItems(collector, resolved);
}
