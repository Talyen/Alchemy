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

  it("returns damage type for a damage effect without lifesteal", () => {
    const effect: BattleCardEffect = { kind: "damage", damageType: "physical", amount: 5 };
    expect(collectKeywordsFromBattleEffect(effect)).toEqual(["physical"]);
  });

  it("includes leech for a damage effect with lifesteal", () => {
    const effect: BattleCardEffect = { kind: "damage", damageType: "nature", amount: 3, lifesteal: true };
    expect(collectKeywordsFromBattleEffect(effect)).toEqual(["nature", "leech"]);
  });

  it("excludes haste for player-status", () => {
    const effect: BattleCardEffect = { kind: "player-status", status: "haste", amount: 1 };
    expect(collectKeywordsFromBattleEffect(effect)).toEqual([]);
  });

  it("returns block for player-status block", () => {
    const effect: BattleCardEffect = { kind: "player-status", status: "block", amount: 5 };
    expect(collectKeywordsFromBattleEffect(effect)).toEqual(["block"]);
  });

  it("returns thorns for player-status thorns", () => {
    const effect: BattleCardEffect = { kind: "player-status", status: "thorns", amount: 2 };
    expect(collectKeywordsFromBattleEffect(effect)).toEqual(["thorns"]);
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

  it("returns archery for next-archery-free", () => {
    const effect: BattleCardEffect = { kind: "next-archery-free" };
    expect(collectKeywordsFromBattleEffect(effect)).toEqual(["archery"]);
  });

  it("deduplicates keywords from chance effect branches", () => {
    const inner: BattleCardEffect = { kind: "damage", damageType: "physical", amount: 2, lifesteal: true };
    const effect: BattleCardEffect = {
      kind: "chance",
      probability: 0.5,
      successEffects: [inner],
      failureEffects: [inner],
    };

    expect(collectKeywordsFromBattleEffect(effect)).toEqual(["physical", "leech"]);
  });

  it("merges distinct keywords from success and failure branches", () => {
    const effect: BattleCardEffect = {
      kind: "chance",
      probability: 0.5,
      successEffects: [{ kind: "heal", amount: 3 }],
      failureEffects: [{ kind: "gain-gold", amount: 5 }],
    };
    expect(collectKeywordsFromBattleEffect(effect)).toEqual(["health", "gold"]);
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
