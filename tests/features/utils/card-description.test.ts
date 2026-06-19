import { describe, expect, it } from "vitest";
import { getEffectiveCardDescriptionLines } from "@/lib/game-data";
import { cardLibrary, type BattleCard } from "@/lib/game-data";

function makeCard(overrides: Partial<BattleCard> = {}): BattleCard {
  return {
    id: "test-card",
    title: "Test Card",
    descriptionLines: [],
    art: "",
    cost: 1,
    effects: [],
    ...overrides,
  };
}

describe("getEffectiveCardDescriptionLines", () => {
  it("returns description lines unchanged when no context is given", () => {
    const card = makeCard({ descriptionLines: ["Deal 5 Physical damage", "Gain 3 Block"] });
    const lines = getEffectiveCardDescriptionLines(card);
    expect(lines).toEqual(["Deal 5 Physical damage", "Gain 3 Block"]);
  });

  it("adjusts damage amount with flatPhysicalDamage", () => {
    const card = makeCard({
      descriptionLines: ["Deal 5 Physical damage"],
      effects: [{ kind: "damage", damageType: "physical", amount: 5 }],
    });
    const lines = getEffectiveCardDescriptionLines(card, { flatPhysicalDamage: 3 });
    expect(lines).toEqual(["Deal 8 Physical damage"]);
  });

  it("does not add flatPhysicalDamage to non-physical damage types", () => {
    const card = makeCard({
      descriptionLines: ["Deal 5 Holy damage"],
      effects: [{ kind: "damage", damageType: "holy", amount: 5 }],
    });
    const lines = getEffectiveCardDescriptionLines(card, { flatPhysicalDamage: 3 });
    expect(lines).toEqual(["Deal 5 Holy damage"]);
  });

  it("adjusts potion damage with potionPotency", () => {
    const card = makeCard({
      id: "health-potion",
      descriptionLines: ["Heal 10", "Gain 5 Block"],
      effects: [
        { kind: "heal", amount: 10 },
        { kind: "player-status", status: "block", amount: 5 },
      ],
    });
    const lines = getEffectiveCardDescriptionLines(card, { potionPotency: 2 });
    expect(lines).toEqual(["Heal 20", "Gain 10 Block"]);
  });

  it("does not adjust non-potion amounts with potionPotency", () => {
    const card = makeCard({
      id: "normal-card",
      descriptionLines: ["Heal 10"],
      effects: [{ kind: "heal", amount: 10 }],
    });
    const lines = getEffectiveCardDescriptionLines(card, { potionPotency: 2 });
    expect(lines).toEqual(["Heal 10"]);
  });

  it("adjusts damage amount with both flatPhysicalDamage and potionPotency", () => {
    const card = makeCard({
      id: "strength-potion",
      descriptionLines: ["Deal 5 Physical damage"],
      effects: [{ kind: "damage", damageType: "physical", amount: 5 }],
    });
    const lines = getEffectiveCardDescriptionLines(card, { flatPhysicalDamage: 2, potionPotency: 3 });
    expect(lines).toEqual(["Deal 17 Physical damage"]);
  });

  it("replaces companion damage line with dynamic companion damage", () => {
    const card = makeCard({
      descriptionLines: ["Deals 1 Bleed damage each turn", "Gain 3 Block"],
      effects: [
        { kind: "player-status", status: "block", amount: 3 },
        { kind: "summon-companion", companionId: "wolf" },
      ],
    });
    const lines = getEffectiveCardDescriptionLines(card, { companionBondLevels: { wolf: 2 } });
    expect(lines[0]).toBe("Deals 3 Bleed damage each turn");
    expect(lines[1]).toBe("Gain 3 Block");
  });

  it("companion damage includes bond level and context bonuses", () => {
    const card = makeCard({
      descriptionLines: ["Deals 1 Bleed damage each turn"],
      effects: [{ kind: "summon-companion", companionId: "wolf" }],
    });
    const lines = getEffectiveCardDescriptionLines(card, {
      companionBondLevels: { wolf: 1 },
      companionDamage: 2,
      companionDamageBonus: 1,
      companionDamageBuff: 1,
    });
    expect(lines[0]).toBe("Deals 6 Bleed damage each turn");
  });

  it("adjusts gold gain amount", () => {
    const card = makeCard({
      id: "luck-potion",
      descriptionLines: ["Gain 10 Gold"],
      effects: [{ kind: "gain-gold", amount: 10 }],
    });
    const lines = getEffectiveCardDescriptionLines(card, { potionPotency: 2 });
    expect(lines).toEqual(["Gain 20 Gold"]);
  });

  it("adjusts heal amount", () => {
    const card = makeCard({
      id: "health-potion",
      descriptionLines: ["Heal 8"],
      effects: [{ kind: "heal", amount: 8 }],
    });
    const lines = getEffectiveCardDescriptionLines(card, { potionPotency: 2 });
    expect(lines).toEqual(["Heal 16"]);
  });

  it("adjusts mana restore amount", () => {
    const card = makeCard({
      id: "mana-potion",
      descriptionLines: ["Restore 4 Mana"],
      effects: [{ kind: "restore-mana", amount: 4 }],
    });
    const lines = getEffectiveCardDescriptionLines(card, { potionPotency: 2 });
    expect(lines).toEqual(["Restore 8 Mana"]);
  });

  it("adjusts wish amount", () => {
    const card = makeCard({
      id: "wish-potion",
      descriptionLines: ["Wish 1"],
      effects: [{ kind: "wish", amount: 1 }],
    });
    const lines = getEffectiveCardDescriptionLines(card, { potionPotency: 3 });
    expect(lines).toEqual(["Wish 3"]);
  });

  it("adjusts harmful status removal amount with pluralization", () => {
    const card = makeCard({
      id: "panacea-potion",
      descriptionLines: ["Remove 2 harmful Statuses"],
      effects: [{ kind: "remove-harmful-status", amount: 2 }],
    });
    const lines = getEffectiveCardDescriptionLines(card, { potionPotency: 2 });
    expect(lines).toEqual(["Remove 4 harmful Statuses"]);
  });

  it("harmful status removal uses singular when amount is 1", () => {
    const card = makeCard({
      descriptionLines: ["Remove 1 harmful Status"],
      effects: [{ kind: "remove-harmful-status", amount: 1 }],
    });
    const lines = getEffectiveCardDescriptionLines(card);
    expect(lines).toEqual(["Remove 1 harmful Status"]);
  });

  it("leaves non-matching lines unchanged", () => {
    const card = makeCard({
      descriptionLines: ["Consume", "A mysterious card"],
      effects: [],
    });
    const lines = getEffectiveCardDescriptionLines(card);
    expect(lines).toEqual(["Consume", "A mysterious card"]);
  });

  it("handles multiple damage effects in sequence", () => {
    const card = makeCard({
      descriptionLines: ["Deal 3 Physical damage", "Deal 5 Holy damage"],
      effects: [
        { kind: "damage", damageType: "physical", amount: 3 },
        { kind: "damage", damageType: "holy", amount: 5 },
      ],
    });
    const lines = getEffectiveCardDescriptionLines(card, { flatPhysicalDamage: 2 });
    expect(lines).toEqual(["Deal 5 Physical damage", "Deal 5 Holy damage"]);
  });

  it("rounds potion-adjusted amounts", () => {
    const card = makeCard({
      id: "odd-potion",
      descriptionLines: ["Heal 5"],
      effects: [{ kind: "heal", amount: 5 }],
    });
    const lines = getEffectiveCardDescriptionLines(card, { potionPotency: 1.3 });
    expect(lines).toEqual(["Heal 7"]);
  });

  it("returns empty array for empty description lines", () => {
    const card = makeCard();
    const lines = getEffectiveCardDescriptionLines(card);
    expect(lines).toEqual([]);
  });

  it("preserves original description for equalToArmor damage", () => {
    const card = makeCard({
      descriptionLines: ["Deal Nature damage equal to your Armor"],
      effects: [{ kind: "damage", damageType: "nature", amount: 0, equalToArmor: true }],
    });
    const lines = getEffectiveCardDescriptionLines(card);
    expect(lines).toEqual(["Deal Nature damage equal to your Armor"]);
  });

  it("preserves original description for equalToBlock damage", () => {
    const card = makeCard({
      descriptionLines: ["Deal Holy damage equal to your Block"],
      effects: [{ kind: "damage", damageType: "holy", amount: 0, equalToBlock: true }],
    });
    const lines = getEffectiveCardDescriptionLines(card);
    expect(lines).toEqual(["Deal Holy damage equal to your Block"]);
  });

  it("preserves equalToArmor description even with potion context", () => {
    const card = makeCard({
      id: "thorn-mail",
      descriptionLines: ["Deal Nature damage equal to your Armor"],
      effects: [{ kind: "damage", damageType: "nature", amount: 0, equalToArmor: true }],
    });
    const lines = getEffectiveCardDescriptionLines(card, { potionPotency: 3 });
    expect(lines).toEqual(["Deal Nature damage equal to your Armor"]);
  });

  it("preserves equalToBlock description even with flatPhysicalDamage context", () => {
    const card = makeCard({
      descriptionLines: ["Deal Holy damage equal to your Block"],
      effects: [{ kind: "damage", damageType: "holy", amount: 0, equalToBlock: true }],
    });
    const lines = getEffectiveCardDescriptionLines(card, { flatPhysicalDamage: 5 });
    expect(lines).toEqual(["Deal Holy damage equal to your Block"]);
  });

  it("preserves original description for equalToGoldPercent damage (Tithe)", () => {
    const card = makeCard({
      descriptionLines: ["Deal Holy damage equal to 10% of your Gold"],
      effects: [{ kind: "damage", damageType: "holy", amount: 0, equalToGoldPercent: 10 }],
    });
    const lines = getEffectiveCardDescriptionLines(card);
    expect(lines).toEqual(["Deal Holy damage equal to 10% of your Gold"]);
  });

  it("preserves equalToGoldPercent description even with flatPhysicalDamage context", () => {
    const card = makeCard({
      descriptionLines: ["Deal Holy damage equal to 10% of your Gold"],
      effects: [{ kind: "damage", damageType: "holy", amount: 0, equalToGoldPercent: 10 }],
    });
    const lines = getEffectiveCardDescriptionLines(card, { flatPhysicalDamage: 5 });
    expect(lines).toEqual(["Deal Holy damage equal to 10% of your Gold"]);
  });

  it("preserves perManaCrystal description (Mana Shield)", () => {
    const card = makeCard({
      descriptionLines: ["Gain 2 Block per Mana Crystal"],
      effects: [{ kind: "player-status", status: "block", amount: 0, perManaCrystal: 2 }],
    });
    expect(getEffectiveCardDescriptionLines(card)).toEqual(["Gain 2 Block per Mana Crystal"]);
    expect(getEffectiveCardDescriptionLines(card, { potionPotency: 2 })).toEqual(["Gain 2 Block per Mana Crystal"]);
  });

  const perManaCrystalCards = cardLibrary.filter((card) =>
    card.descriptionLines.some((line) => line.includes("per Mana Crystal")),
  );

  it.each(perManaCrystalCards.map((c) => [c.id, c] as const))(
    "%s — per Mana Crystal lines are preserved in effective descriptions",
    (_id, card) => {
      const effective = getEffectiveCardDescriptionLines(card);
      card.descriptionLines.forEach((line, i) => {
        if (line.includes("per Mana Crystal")) {
          expect(effective[i]).toBe(line);
        }
      });
    },
  );
});
