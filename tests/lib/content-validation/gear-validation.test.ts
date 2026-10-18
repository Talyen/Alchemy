import { expect, it } from "vitest";
import {
  buildEligibleAffixPool,
  gearAffixCatalog,
  gearDefinitionList,
  gearDefinitions,
  uniqueItemList,
  type GearAffixDefinition,
  type GearAffixId,
  type GearDefinition,
  type UniqueItemDefinition,
} from "@/lib/gear";
import { createCollector } from "@/lib/content-validation/utils";
import { validateGear, type GearValidationData } from "@/lib/content-validation/validators-gear";
import type { ContentValidationIssue } from "@/lib/content-validation/types";

interface GearDamage {
  definitions: Record<string, GearDefinition>;
  definitionList: GearDefinition[];
  affixCatalog: Record<string, GearAffixDefinition>;
  uniques: UniqueItemDefinition[];
}

function collectGearIssues(
  damage: (data: GearDamage) => void = () => {},
  extra?: Pick<GearValidationData, "eligibleAffixesFor">,
): ContentValidationIssue[] {
  // Damaged clones keep the live catalogs untouched, so cases cannot leak
  // into each other and no restore step exists to forget.
  const data: GearDamage = {
    definitions: structuredClone(gearDefinitions),
    definitionList: structuredClone(gearDefinitionList),
    affixCatalog: structuredClone(gearAffixCatalog),
    uniques: structuredClone(uniqueItemList),
  };
  damage(data);
  const collector = createCollector();
  validateGear(collector, { ...data, ...extra });
  return collector.issues;
}

it("reports duplicate gear, invalid affix names and salvage, and unknown art through the shared content gate", () => {
  const issues = collectGearIssues((data) => {
    const damaged = data.definitionList[0]!;
    damaged.art = "missing-art.webp";
    damaged.salvageValue.wood = -1;
    data.definitionList.push(damaged);
    data.affixCatalog["flat-physical"]!.name = "";
  });
  expect(issues).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: "flat-physical", message: expect.stringContaining("name") }),
      expect.objectContaining({ message: expect.stringContaining("Duplicate gear definition id") }),
      expect.objectContaining({ message: expect.stringContaining("salvageValue.wood") }),
      expect.objectContaining({ message: "Art reference is not in the known optimized asset registries" }),
    ]),
  );
});

it.each([
  {
    requirement: "ordinary affixes must be obtainable",
    damage: () => {},
    extra: {
      eligibleAffixesFor: (definition: GearDefinition) =>
        buildEligibleAffixPool(definition).filter((affix) => affix.id !== "flat-physical"),
    },
    message: "Ordinary affix is not reachable on Basic or Astral gear",
  },
  {
    requirement: "affix names distinguish different bonuses",
    damage: (data: GearDamage) => {
      data.affixCatalog["flat-burn"]!.name = data.affixCatalog["flat-physical"]!.name;
    },
    message: "Duplicate gear affix name: Ironbound",
  },
  {
    requirement: "Unique-only affixes have fixed rolls",
    damage: (data: GearDamage) => {
      data.affixCatalog["saintfall"]!.roll.basic.max += 1;
    },
    message: "Unique-only affix must have fixed rolls at every rarity",
  },
  {
    requirement: "reversed roll ranges block shipping",
    damage: (data: GearDamage) => {
      data.affixCatalog["flat-physical"]!.roll.basic.min = 99;
    },
    message: "basic roll min is greater than max",
  },
  {
    requirement: "Unique IDs cannot silently overwrite each other",
    damage: (data: GearDamage) => {
      data.uniques[1]!.id = data.uniques[0]!.id;
    },
    message: "Duplicate unique item id: wardbreaker",
  },
  {
    requirement: "supporting affixes must exist",
    damage: (data: GearDamage) => {
      data.uniques[0]!.supportingAffixes[0]!.id = "constructor" as GearAffixId;
    },
    message: "Unknown supporting affix constructor",
  },
  {
    requirement: "a Unique has three distinct supporting bonuses",
    damage: (data: GearDamage) => {
      data.uniques[0]!.supportingAffixes[1] = data.uniques[0]!.supportingAffixes[0]!;
    },
    message: "Duplicate supporting affix: flat-stun",
  },
  {
    requirement: "signature values match their fixed canonical rolls",
    damage: (data: GearDamage) => {
      data.uniques[0]!.signatureAffix.value += 1;
    },
    message: "Signature wardbreaker-purge must roll the unique maximum (1)",
  },
  {
    requirement: "every Unique has a generated inventory definition",
    damage: (data: GearDamage) => {
      delete data.definitions.wardbreaker;
    },
    message: "Missing generated gear definition for unique item",
  },
  {
    requirement: "generated definitions without barrel art cannot ship",
    damage: (data: GearDamage) => {
      data.definitionList.push({ ...data.definitionList[0]!, id: "test-no-art-mapping" });
    },
    message: "Missing generated gear art mapping",
  },
])("rejects damaged gear because $requirement", ({ damage, extra, message }) => {
  const issues = collectGearIssues(damage, extra);
  expect(issues).toContainEqual(expect.objectContaining({ severity: "error", area: "gear", message }));
});
