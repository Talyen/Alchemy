import { describe, expect, it } from "vitest";
import {
  collectKeywordsFromBattleEffect,
  describeCardEffects,
  effectDescriptionLine,
} from "@/lib/game-data/effect-metadata";
import { DAMAGE_TYPES, type BattleCardEffect } from "@/lib/game-data";

describe("repeated effect descriptions", () => {
  it.each([false, true])(
    "merges equivalent damage regardless of field insertion order (scheduled: %s)",
    (scheduled) => {
      const hit: BattleCardEffect = { kind: "damage", damageType: "physical", amount: 3 };
      const copy: BattleCardEffect = { amount: 3, damageType: "physical", kind: "damage" };
      const next: BattleCardEffect = scheduled
        ? { kind: "repeat-over-turns", remainingTurns: 1, effects: [copy] }
        : copy;
      expect(describeCardEffects([hit, next])).toEqual([
        `Deal 3 Physical damage ${scheduled ? "this turn and next" : "twice"}`,
      ]);
    },
  );

  it("keeps different damage pool orders separate", () => {
    const hit: BattleCardEffect = {
      kind: "damage",
      damageType: "physical",
      amount: 3,
      damageTypePool: ["physical", "holy"],
    };
    expect(describeCardEffects([hit, { ...hit, damageTypePool: ["holy", "physical"] }])).toEqual([
      "Deal 3 Physical or Holy damage",
      "Deal 3 Holy or Physical damage",
    ]);
  });
});

describe("collectKeywordsFromBattleEffect", () => {
  it("retains every nested outcome and conditional type in first-seen order without duplicate keywords", () => {
    const effect: BattleCardEffect = {
      kind: "chance",
      probability: 0.5,
      successEffects: [
        {
          kind: "repeat-over-turns",
          remainingTurns: 2,
          effects: [
            {
              kind: "damage",
              damageType: "physical",
              amount: 2,
              damageTypePool: ["burn", "holy"],
              lifesteal: true,
              damageTypeIfTargetHasBlock: "nature",
              damageTypeIfTargetFrozen: "burn",
              amountIfTargetFrozen: 4,
            },
          ],
        },
      ],
      failureEffects: [
        { kind: "heal", amount: 3 },
        { kind: "damage", damageType: "burn", amount: 1 },
        { kind: "player-status", status: "haste", amount: 1 },
      ],
    };
    const before = structuredClone(effect);
    expect(collectKeywordsFromBattleEffect(effect)).toEqual(["burn", "holy", "leech", "nature", "health"]);
    expect(effect).toEqual(before);
  });
  it.each<BattleCardEffect>([
    { kind: "random-damage", minAmount: 1, maxAmount: 4, damageTypePool: ["burn", "holy"] },
    { kind: "player-status", status: "block", statusPool: ["block", "armor"], amount: 3 },
  ])("does not expose effect-owned pools through keyword results for $kind", (effect) => {
    const before = structuredClone(effect);
    const expected = [...collectKeywordsFromBattleEffect(effect)];
    collectKeywordsFromBattleEffect(effect).reverse().push("gold");
    expect(effect).toEqual(before);
    expect(collectKeywordsFromBattleEffect(effect)).toEqual(expected);
  });

  it("includes every outcome keyword for a pooled player status", () => {
    const effect: BattleCardEffect = {
      kind: "player-status",
      status: "block",
      statusPool: ["block", "forge", "armor"],
      amount: 5,
    };
    expect(collectKeywordsFromBattleEffect(effect)).toEqual(["block", "forge", "armor"]);
    expect(effectDescriptionLine(effect)).toBe("Gain 5 Block, Forge, or Armor");
  });
});

describe("variable damage keywords", () => {
  it("classifies unrestricted random damage by every possible type", () => {
    expect(collectKeywordsFromBattleEffect({ kind: "random-damage", minAmount: 1, maxAmount: 6 })).toEqual(
      DAMAGE_TYPES,
    );
  });

  it("classifies pooled random damage by every possible type", () => {
    expect(
      collectKeywordsFromBattleEffect({
        kind: "random-damage",
        minAmount: 1,
        maxAmount: 4,
        damageTypePool: ["stun", "physical", "bleed"],
      }),
    ).toEqual(["stun", "physical", "bleed"]);
  });

  it("groups Exorcism as Burn + Holy, not Health", () => {
    expect(
      collectKeywordsFromBattleEffect({ kind: "cleanse-player-status-to-damage", status: "burn", damageType: "holy" }),
    ).toEqual(["burn", "holy"]);
  });

  it("uses every possible damage type instead of the placeholder type", () => {
    expect(
      collectKeywordsFromBattleEffect({
        kind: "damage",
        damageType: "physical",
        amount: 3,
        damageTypePool: ["freeze", "burn", "holy"],
        lifesteal: true,
      }),
    ).toEqual(["freeze", "burn", "holy", "leech"]);
  });
});
