import { describe, expect, it } from "vitest";
import { GEAR_AFFIX_IDS, gearAffixCatalog } from "@/lib/gear/affix-catalog";
import { defaultGearEffects, getGearAffixTooltipEntries, normalizeAffixRolls, resolveAffixEffects } from "@/lib/gear";
import { buildEligibleAffixPool } from "@/lib/gear/affix-pool";
import { gearDefinitions } from "@/lib/gear/definitions";

describe("gear affixes", () => {
  it("shows both Saintfall magnitudes in its tooltip", () => {
    const [entry] = getGearAffixTooltipEntries([{ id: "saintfall", value: 4 }], "unique");
    expect(entry?.text).toBe("When Block is depleted, deal 4 Holy to the attacker and restore 4 Health");
  });

  describe("normalizeAffixRolls", () => {
    it("validates and rounds canonical affix rolls", () => {
      expect(
        normalizeAffixRolls([
          { id: "flat-burn", value: 2.4 },
          { id: "flat-physical", value: 5 },
        ]),
      ).toEqual([
        { id: "flat-burn", value: 2 },
        { id: "flat-physical", value: 5 },
      ]);
    });

    it("strips invalid and non-positive roll values", () => {
      expect(
        normalizeAffixRolls([
          { id: "flat-physical", value: 2 },
          { id: "not-an-affix", value: 1 },
          { id: "flat-stun", value: 0 },
        ]),
      ).toEqual([{ id: "flat-physical", value: 2 }]);
    });
  });

  describe("resolveAffixEffects", () => {
    it.each(GEAR_AFFIX_IDS)("maps %s to its catalog effect key", (affixId) => {
      const definition = gearAffixCatalog[affixId];
      const effects = resolveAffixEffects([{ id: affixId, value: 3 }]);
      expect(effects[definition.effectKey]).toBe(defaultGearEffects[definition.effectKey] + 3);
    });
  });
});

describe("rebalanced saved affixes", () => {
  it.each(["basic", "astral", "unique"] as const)("uses one fixed Aetherward effect for %s gear", (rarity) => {
    const rolls = normalizeAffixRolls([{ id: "absorb-per-mana", value: 5 }], rarity);
    expect(rolls).toEqual([{ id: "absorb-per-mana", value: 1 }]);
    expect(getGearAffixTooltipEntries(rolls, rarity)[0]?.text).toBe(
      "Reduce damage taken by your number of full Mana Crystals",
    );
  });

  it.each(["basic", "astral", "unique"] as const)("normalizes Lifegiving to 1 for %s gear", (rarity) => {
    const normalized = normalizeAffixRolls([{ id: "health-per-turn", value: 4 }], rarity);
    expect(normalized).toEqual([{ id: "health-per-turn", value: 1 }]);
    expect(normalizeAffixRolls(normalized, rarity)).toEqual(normalized);
  });
  it.each([
    ["basic", 1],
    ["astral", 2],
  ] as const)("normalizes Emberforged for %s gear", (rarity, value) => {
    expect(normalizeAffixRolls([{ id: "forge-on-burn", value: 4 }], rarity)).toEqual([{ id: "forge-on-burn", value }]);
  });
});

describe("new ordinary affixes", () => {
  it("makes every new affix eligible on at least one Basic or Astral item", () => {
    const newIds = [
      "start-thorns",
      "thorns-damage",
      "thorns-on-block-depleted",
      "forge-on-consume-burn",
      "armor-on-thorns-damage",
      "mana-on-paid-consume",
      "poison-tick-on-consume",
      "draw-on-last-hand-consume",
      "block-on-companion-summon",
      "forge-on-companion-burning-damage",
      "archery-draw-chance",
      "block-on-archery-without-block",
      "armor-gain",
      "armor-on-nature-card",
      "block-on-wish",
      "leech-block-chance",
      "block-on-last-forge-spent",
      "thorns-on-nature-without-thorns",
      "poison-on-thorns-damage",
      "heal-on-combat-gold",
      "gold-on-kill-with-forge",
      "thorns-on-leech-without-thorns",
      "stun-on-leech-below-half",
      "discount-on-empty-hand-wish",
      "freeze-on-wish",
      "armor-on-consume",
      "holy-on-consume-without-mana",
      "stun-on-armor-lost-to-attack",
      "nature-leech-vs-poisoned",
      "poison-bonus-vs-bleeding",
      "physical-leech-below-half",
      "block-on-holy-hit-without-block",
      "holy-bonus-vs-stunned",
    ] as const;
    const reachable = new Set(
      Object.values(gearDefinitions)
        .filter((definition) => definition.rarity === "basic" || definition.rarity === "astral")
        .flatMap((definition) => buildEligibleAffixPool(definition).map((affix) => affix.id)),
    );
    expect(newIds.filter((id) => !reachable.has(id))).toEqual([]);
  });

  it("keeps the revised Rotbloom, Bloodward, and Smithguard tooltip contracts", () => {
    expect(gearAffixCatalog["poison-tick-on-consume"].roll).toMatchObject({
      basic: { min: 1, max: 1 },
      astral: { min: 1, max: 1 },
    });
    expect(getGearAffixTooltipEntries([{ id: "poison-tick-on-consume", value: 1 }], "basic")[0]?.text).toBe(
      "When you Consume a card, your Poison deals damage immediately",
    );
    expect(gearAffixCatalog["leech-block-chance"].roll).toMatchObject({
      basic: { min: 10, max: 15 },
      astral: { min: 15, max: 20 },
    });
    expect(getGearAffixTooltipEntries([{ id: "leech-block-chance", value: 15 }], "basic")[0]?.text).toBe(
      "Leech has a 15% chance to also grant an equal amount of Block",
    );
    expect(getGearAffixTooltipEntries([{ id: "block-on-last-forge-spent", value: 3 }], "basic")[0]?.text).toBe(
      "When you spend your last Forge, gain 3 Block",
    );
  });
});
