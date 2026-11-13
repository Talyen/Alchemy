import { expect, it } from "vitest";
import { cardLibrary, enemyBestiary } from "@/lib/game-data";
import { gearDefinitionList, gearAffixList } from "@/lib/gear";
import { ENCOUNTER_TRAITS } from "@/lib/content-systems/encounter-traits";
import {
  CardContentSchema,
  GearDefinitionContentSchema,
  GearAffixContentSchema,
  EncounterTraitContentSchema,
  EnemyContentSchema,
} from "@/lib/content-validation/schemas";

it("rejects enemies with wrong ability counts or duplicates", () => {
  const base = enemyBestiary[0];
  expect(EnemyContentSchema.safeParse({ ...base, abilityIds: ["a", "b"] }).success).toBe(false);
  expect(
    EnemyContentSchema.safeParse({ ...base, abilityIds: [base.abilityIds[0], base.abilityIds[0], "other"] }).success,
  ).toBe(false);
  expect(EnemyContentSchema.safeParse({ ...base, enemyType: "minion" }).success).toBe(false);
});

it.each<[string, () => { success: boolean }]>([
  ["blank player-facing text", () => CardContentSchema.safeParse({ ...cardLibrary[0], title: " \t\n" })],
  [
    "unknown salvage material",
    () =>
      GearDefinitionContentSchema.safeParse({
        ...gearDefinitionList[0],
        salvageValue: { ...gearDefinitionList[0]!.salvageValue, woods: 5 },
      }),
  ],
  [
    "missing salvage material",
    () => GearDefinitionContentSchema.safeParse({ ...gearDefinitionList[0], salvageValue: {} }),
  ],
  [
    "duplicate gear slots",
    () =>
      GearDefinitionContentSchema.safeParse({
        ...gearDefinitionList[0],
        slotRule: "standard",
        compatibleSlots: ["body", "body"],
      }),
  ],
  [
    "duplicate gear affinities",
    () =>
      GearDefinitionContentSchema.safeParse({ ...gearDefinitionList[0], affinityKeywords: ["physical", "physical"] }),
  ],
  [
    "non-boolean unique-only policy",
    () => GearAffixContentSchema.safeParse({ ...gearAffixList[0], uniqueOnly: "false" }),
  ],
  [
    "redundant secondary affinity",
    () => GearAffixContentSchema.safeParse({ ...gearAffixList[0], secondaryKeywordId: gearAffixList[0]!.keywordId }),
  ],
  [
    "two-handed gear in an off-hand slot",
    () =>
      GearDefinitionContentSchema.safeParse({
        ...gearDefinitionList[0],
        slotRule: "two-handed",
        compatibleSlots: ["off-hand"],
      }),
  ],
  [
    "ranged gear in a body slot",
    () =>
      GearDefinitionContentSchema.safeParse({
        ...gearDefinitionList[0],
        slotRule: "ranged",
        compatibleSlots: ["body"],
      }),
  ],
  [
    "quivers in a main-hand slot",
    () =>
      GearDefinitionContentSchema.safeParse({
        ...gearDefinitionList[0],
        slotRule: "quiver",
        compatibleSlots: ["main-hand"],
      }),
  ],
  [
    "misclassified encounter trait",
    () => EncounterTraitContentSchema.safeParse({ ...ENCOUNTER_TRAITS.generous, category: "combat" }),
  ],
  [
    "duplicate encounter modes",
    () => EncounterTraitContentSchema.safeParse({ ...ENCOUNTER_TRAITS.generous, modes: ["labyrinth", "labyrinth"] }),
  ],
])("rejects %s", (_label, parse) => {
  expect(parse().success).toBe(false);
});

it("accepts authored gear and encounter catalogs without changing their values", () => {
  for (const definition of gearDefinitionList)
    expect(GearDefinitionContentSchema.parse(definition)).toEqual(definition);
  for (const affix of gearAffixList) expect(GearAffixContentSchema.safeParse(affix).success).toBe(true);
  for (const trait of Object.values(ENCOUNTER_TRAITS)) {
    const original = structuredClone(trait);
    expect(EncounterTraitContentSchema.safeParse(trait).success).toBe(true);
    expect(trait).toEqual(original);
  }
  const card = { ...cardLibrary[0]!, title: "  Intentional spacing  " };
  expect(CardContentSchema.parse(card).title).toBe(card.title);
});
