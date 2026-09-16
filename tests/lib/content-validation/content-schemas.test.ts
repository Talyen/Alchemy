import { describe, expect, it } from "vitest";
import { cardLibrary, companionLibrary, enemyBestiary } from "@/lib/game-data";
import { gearAffixCatalog, gearDefinitionList } from "@/lib/gear";
import { ENCOUNTER_TRAITS } from "@/lib/content-systems/encounter-traits";
import {
  CardContentSchema,
  CompanionContentSchema,
  EncounterTraitContentSchema,
  EnemyContentSchema,
  GearAffixContentSchema,
  GearDefinitionContentSchema,
} from "@/lib/content-validation/schemas";

// Structural schema rejects with synthetic mutations. Valid catalog entries
// are the baselines; the clean-catalog gate covers the accept paths.
describe("content schemas", () => {
  it("accepts catalog baselines", () => {
    expect(CardContentSchema.safeParse(cardLibrary[0]).success).toBe(true);
    expect(EnemyContentSchema.safeParse(enemyBestiary[0]).success).toBe(true);
    expect(CompanionContentSchema.safeParse(Object.values(companionLibrary)[0]).success).toBe(true);
    const [traitId, trait] = Object.entries(ENCOUNTER_TRAITS)[0];
    expect(EncounterTraitContentSchema.safeParse(trait).success).toBe(true);
    expect(traitId.length).toBeGreaterThan(0);
    expect(GearDefinitionContentSchema.safeParse(gearDefinitionList[0]).success).toBe(true);
    expect(GearAffixContentSchema.safeParse(Object.values(gearAffixCatalog)[0]).success).toBe(true);
  });

  it("rejects cards with empty fields or negative cost", () => {
    const base = cardLibrary[0];
    expect(CardContentSchema.safeParse({ ...base, id: "" }).success).toBe(false);
    expect(CardContentSchema.safeParse({ ...base, descriptionLines: [] }).success).toBe(false);
    expect(CardContentSchema.safeParse({ ...base, cost: -1 }).success).toBe(false);
    expect(CardContentSchema.safeParse({ ...base, cost: 1.5 }).success).toBe(false);
  });

  it("rejects enemies with wrong ability counts or duplicates", () => {
    const base = enemyBestiary[0];
    expect(EnemyContentSchema.safeParse({ ...base, abilityIds: ["a", "b"] }).success).toBe(false);
    expect(
      EnemyContentSchema.safeParse({ ...base, abilityIds: [base.abilityIds[0], base.abilityIds[0], "other"] }).success,
    ).toBe(false);
    expect(EnemyContentSchema.safeParse({ ...base, enemyType: "minion" }).success).toBe(false);
  });

  it("rejects companions with no turn-start effects", () => {
    const base = Object.values(companionLibrary)[0];
    expect(CompanionContentSchema.safeParse({ ...base, turnStartEffects: [] }).success).toBe(false);
  });

  it("rejects encounter traits with empty labels or unknown ids", () => {
    const trait = Object.values(ENCOUNTER_TRAITS)[0];
    expect(EncounterTraitContentSchema.safeParse({ ...trait, label: "" }).success).toBe(false);
    expect(EncounterTraitContentSchema.safeParse({ ...trait, id: "not-a-trait" }).success).toBe(false);
    expect(EncounterTraitContentSchema.safeParse({ ...trait, category: "daily" }).success).toBe(false);
  });

  it("rejects gear with negative salvage or unknown affix ids", () => {
    const definition = gearDefinitionList[0];
    const [salvageKey] = Object.keys(definition.salvageValue);
    expect(
      GearDefinitionContentSchema.safeParse({
        ...definition,
        salvageValue: { ...definition.salvageValue, [salvageKey]: -1 },
      }).success,
    ).toBe(false);
    const affix = Object.values(gearAffixCatalog)[0];
    expect(GearAffixContentSchema.safeParse({ ...affix, id: "not-an-affix" }).success).toBe(false);
    expect(GearAffixContentSchema.safeParse({ ...affix, aspect: "magical" }).success).toBe(false);
  });
});
