import { describe, expect, it } from "vitest";
import { enemyById, getEnemyAbilityCard, getEnemyAbilities, type EnemyAbilityEffect } from "@/lib/game-data";
import {
  getEncounterEnemyAbility,
  getEncounterEnemyTrait,
  type EnemyDescriptionContext,
} from "@/lib/battle/enemy-description";
import { scaleEnemyAbilityDamage } from "@/lib/battle/battle-enemy-setup";

const context: EnemyDescriptionContext = {
  currentEnemy: enemyById.goblin,
  roomScalingMultiplier: 1.25,
  difficultyModifiers: [],
};
function display(effects: EnemyAbilityEffect[], ctx = context) {
  return getEncounterEnemyAbility({ ...getEnemyAbilityCard("slash"), effects }, ctx);
}

describe("encounter enemy descriptions", () => {
  it.each(["goblin", "mimic", "forge-golem"] as const)(
    "matches ability scaling for %s without mutating definitions",
    (id) => {
      const ctx: EnemyDescriptionContext = {
        ...context,
        currentEnemy: enemyById[id],
        roomScalingMultiplier: 2.35,
        difficultyModifiers: [
          { kind: "increase-enemy-damage", amount: 2 },
          { kind: "enemy-damage-multiplier", amount: 1.3 },
        ],
      };
      const cards = getEnemyAbilities(ctx.currentEnemy);
      const before = JSON.stringify(cards);
      for (const card of cards) {
        const result = getEncounterEnemyAbility(card, ctx);
        card.effects.forEach((effect, index) => {
          if (effect.kind === "damage" && !effect.equalToBlock)
            expect(result.effects[index]).toMatchObject(scaleEnemyAbilityDamage(ctx, effect));
        });
      }
      expect(JSON.stringify(cards)).toBe(before);
    },
  );

  it("scales nested grants and flat removal while preserving chance, percentages and factors", () => {
    const result = display([
      {
        kind: "chance",
        probability: 0.5,
        successEffects: [
          { kind: "player-status", status: "block", amount: 4 },
          { kind: "heal", amount: 4 },
        ],
        failureEffects: [
          { kind: "remove-enemy-armor", amount: 4 },
          { kind: "multiply-enemy-status", status: "freeze", factor: 2 },
        ],
      },
    ]);
    expect(result.effects[0]).toEqual({
      kind: "chance",
      probability: 0.5,
      successEffects: [
        { kind: "player-status", status: "block", amount: 5 },
        { kind: "heal", amount: 5 },
      ],
      failureEffects: [
        { kind: "remove-enemy-armor", amount: 5 },
        { kind: "multiply-enemy-status", status: "freeze", factor: 2 },
      ],
    });
    expect(result.descriptionLines.join(" ")).toContain("5 Block");
  });

  it("scales conditional alternatives independently, including type bonuses", () => {
    const ctx: EnemyDescriptionContext = {
      ...context,
      difficultyModifiers: [{ kind: "increase-enemy-physical-damage", amount: 3 }],
    };
    const conditional = display(
      [
        {
          kind: "damage",
          damageType: "physical",
          amount: 4,
          damageTypeIfTargetFrozen: "freeze",
          amountIfTargetFrozen: 8,
        },
      ],
      ctx,
    );
    expect(conditional.effects[0]).toMatchObject({
      amount: scaleEnemyAbilityDamage(ctx, { kind: "damage", damageType: "physical", amount: 4 }).amount,
      amountIfTargetFrozen: scaleEnemyAbilityDamage(ctx, { kind: "damage", damageType: "freeze", amount: 8 }).amount,
    });
  });

  it("shows distinct random damage alternatives when difficulty bonuses differ", () => {
    const result = display(
      [{ kind: "damage", damageType: "bleed", damageTypePool: ["bleed", "physical"], amount: 2, lifesteal: true }],
      { ...context, difficultyModifiers: [{ kind: "increase-enemy-physical-damage", amount: 3 }] },
    );
    expect(result.descriptionLines).toEqual(["Deal 7 Bleed or 10 Physical damage", "Leech"]);
  });

  it("retains resource wording and positive damage minimums", () => {
    expect(
      display([{ kind: "damage", damageType: "physical", amount: 0, equalToBlock: true, equalToBlockPercent: 50 }])
        .descriptionLines,
    ).toEqual(["Deal Physical damage equal to half your Block"]);
    const result = display([{ kind: "damage", damageType: "physical", amount: 1 }], {
      ...context,
      roomScalingMultiplier: 0.01,
    });
    expect(result.descriptionLines).toEqual(["Deal 1 Physical damage"]);
  });

  it("scales trait magnitudes without scaling fixed grants, triggers or percentages", () => {
    const trait = (id: string, description: string) =>
      getEncounterEnemyTrait({ id, title: id, description }, { ...context, roomScalingMultiplier: 2 }).description;
    expect(trait("starting-block", "Starts with 4 Block")).toBe("Starts with 8 Block");
    expect(trait("stone-golem", "Gains 1 Block each turn\nDeals 1 additional damage while it has Block")).toBe(
      "Gains 1 Block each turn\nDeals 2 additional damage while it has Block",
    );
    expect(
      trait("thorns", "Gains 1 Thorns each turn; deals 1 Physical damage per attacking card while alive"),
    ).toContain("Gains 1 Thorns each turn; deals 2 Physical");
    expect(trait("divine-aegis", "Gains 2 Armor and 4 Block the first time reaching 50% Health")).toBe(
      "Gains 4 Armor and 8 Block the first time reaching 50% Health",
    );
    expect(trait("iron-hide", "Gains 1 Armor every other turn")).toBe("Gains 1 Armor every other turn");
    expect(trait("regeneration", "Restores Health each turn")).toMatch(/Restores \d+ Health each turn/);
  });
});
