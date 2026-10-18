import { beforeEach, expect, it, vi } from "vitest";
import * as gear from "@/lib/gear";
import { buildEligibleAffixPool } from "@/lib/gear/affix-pool";
import { createCollector } from "@/lib/content-validation/utils";
import { validateGear } from "@/lib/content-validation/validators-gear";

vi.mock("@/lib/gear", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gear")>();
  return {
    ...actual,
    gearDefinitionList: structuredClone(actual.gearDefinitionList),
    gearDefinitions: structuredClone(actual.gearDefinitions),
    gearAffixCatalog: structuredClone(actual.gearAffixCatalog),
    uniqueItemList: structuredClone(actual.uniqueItemList),
    missingGearArtDefinitionIds: [],
    buildEligibleAffixPool: vi.fn(actual.buildEligibleAffixPool),
  };
});

const original = structuredClone({
  definitions: gear.gearDefinitions,
  definitionList: gear.gearDefinitionList,
  affixes: gear.gearAffixCatalog,
  uniques: gear.uniqueItemList,
});

beforeEach(() => {
  for (const key of Object.keys(gear.gearDefinitions)) delete gear.gearDefinitions[key];
  Object.assign(gear.gearDefinitions, structuredClone(original.definitions));
  Object.assign(gear.gearAffixCatalog, structuredClone(original.affixes));
  gear.gearDefinitionList.splice(0, Infinity, ...structuredClone(original.definitionList));
  gear.uniqueItemList.splice(0, Infinity, ...structuredClone(original.uniques));
  gear.missingGearArtDefinitionIds.length = 0;
  vi.mocked(gear.buildEligibleAffixPool).mockImplementation(buildEligibleAffixPool);
});

it("reports duplicate gear, invalid affix names and salvage, and unknown art through the shared content gate", () => {
  const damaged = gear.gearDefinitionList[0]!;
  damaged.art = "missing-art.webp";
  damaged.salvageValue.wood = -1;
  gear.gearDefinitionList.push(damaged);
  gear.gearAffixCatalog["flat-physical"].name = "";
  const collector = createCollector();
  validateGear(collector);
  expect(collector.issues).toEqual(
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
    damage: () =>
      vi
        .mocked(gear.buildEligibleAffixPool)
        .mockImplementation((definition) =>
          buildEligibleAffixPool(definition).filter((affix) => affix.id !== "flat-physical"),
        ),
    message: "Ordinary affix is not reachable on Basic or Astral gear",
  },
  {
    requirement: "affix names distinguish different bonuses",
    damage: () => {
      gear.gearAffixCatalog["flat-burn"].name = gear.gearAffixCatalog["flat-physical"].name;
    },
    message: "Duplicate gear affix name: Ironbound",
  },
  {
    requirement: "Unique-only affixes have fixed rolls",
    damage: () => {
      gear.gearAffixCatalog.saintfall.roll.basic.max += 1;
    },
    message: "Unique-only affix must have fixed rolls at every rarity",
  },
  {
    requirement: "reversed roll ranges block shipping",
    damage: () => {
      gear.gearAffixCatalog["flat-physical"].roll.basic.min = 99;
    },
    message: "basic roll min is greater than max",
  },
  {
    requirement: "Unique IDs cannot silently overwrite each other",
    damage: () => {
      gear.uniqueItemList[1]!.id = gear.uniqueItemList[0]!.id;
    },
    message: "Duplicate unique item id: wardbreaker",
  },
  {
    requirement: "supporting affixes must exist",
    damage: () => {
      gear.uniqueItemList[0]!.supportingAffixes[0].id = "constructor" as gear.GearAffixId;
    },
    message: "Unknown supporting affix constructor",
  },
  {
    requirement: "a Unique has three distinct supporting bonuses",
    damage: () => {
      gear.uniqueItemList[0]!.supportingAffixes[1] = gear.uniqueItemList[0]!.supportingAffixes[0];
    },
    message: "Duplicate supporting affix: flat-stun",
  },
  {
    requirement: "signature values match their fixed canonical rolls",
    damage: () => {
      gear.uniqueItemList[0]!.signatureAffix.value += 1;
    },
    message: "Signature wardbreaker-purge must roll the unique maximum (1)",
  },
  {
    requirement: "every Unique has a generated inventory definition",
    damage: () => {
      delete gear.gearDefinitions.wardbreaker;
    },
    message: "Missing generated gear definition for unique item",
  },
  {
    requirement: "fallback art cannot conceal missing Unique artwork",
    damage: () => {
      gear.missingGearArtDefinitionIds.push("wardbreaker");
    },
    message: "Gear definition uses missing-art fallback",
  },
])("rejects damaged gear because $requirement", ({ damage, message }) => {
  damage();
  const collector = createCollector();
  validateGear(collector);
  expect(collector.issues).toContainEqual(expect.objectContaining({ severity: "error", area: "gear", message }));
});
