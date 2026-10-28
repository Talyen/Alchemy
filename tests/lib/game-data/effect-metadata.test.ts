import { describe, expect, it } from "vitest";
import { collectKeywordsFromBattleEffects, describeCardEffects } from "@/lib/game-data/effect-metadata";
import { type BattleCardEffect } from "@/lib/game-data";

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

describe("collectKeywordsFromBattleEffects", () => {
  it("retains every nested outcome and conditional type in first-seen order without duplicate keywords", () => {
    const branch: BattleCardEffect = {
      kind: "chance",
      probability: 0.5,
      successEffects: [
        {
          kind: "repeat-over-turns",
          remainingTurns: 2,
          effects: [
            {
              kind: "damage",
              damageType: "burn",
              amount: 2,
              lifesteal: true,
              damageTypeIfTargetFrozen: "holy",
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
    const effect: BattleCardEffect = {
      kind: "repeat-over-turns",
      remainingTurns: 1,
      effects: [branch, { kind: "heal", amount: 1 }],
    };
    const before = structuredClone(effect);
    expect(collectKeywordsFromBattleEffects([effect])).toEqual(["burn", "leech", "holy", "health"]);
    expect(effect).toEqual(before);
  });
  it.each<BattleCardEffect>([
    { kind: "random-damage", minAmount: 1, maxAmount: 4, damageTypePool: ["burn", "holy"] },
    { kind: "player-status", status: "block", statusPool: ["block", "armor"], amount: 3 },
  ])("does not expose effect-owned pools through keyword results for $kind", (effect) => {
    const before = structuredClone(effect);
    const expected = [...collectKeywordsFromBattleEffects([effect])];
    collectKeywordsFromBattleEffects([effect]).reverse().push("gold");
    expect(effect).toEqual(before);
    expect(collectKeywordsFromBattleEffects([effect])).toEqual(expected);
  });
});

it("retains damage modifiers in recursive descriptions instead of merging away their clauses", () => {
  const hit: BattleCardEffect = {
    kind: "damage",
    amount: 3,
    damageType: "physical",
    ignoreArmor: true,
    ignoreBlock: true,
    doubleIfEnemyBleeding: true,
    detonateAllBleed: true,
  };
  const lines = [
    "Deal 3 Physical damage",
    "Ignores Armor and Block",
    "Doubled if the enemy was already Bleeding",
    "Detonate all Bleed",
  ];
  expect(describeCardEffects([hit, { ...hit }])).toEqual([...lines, ...lines]);
  expect(
    describeCardEffects([{ kind: "repeat-over-turns", remainingTurns: 1, effects: [{ ...hit, lifesteal: true }] }]),
  ).toEqual([...lines, "Leech"].map((line) => `${line} next turn`));
});

it.each<{ effect: BattleCardEffect; expected: string[] }>([
  {
    effect: {
      kind: "damage",
      damageType: "physical",
      amount: 1,
      damageTypePool: ["holy", "burn"],
      lifesteal: true,
      damageTypeIfTargetFrozen: "freeze",
      equalToBlock: true,
      equalToArmor: true,
      forgeBonusPercent: 0,
    },
    expected: ["holy", "burn", "leech", "freeze", "block", "armor", "forge"],
  },
  {
    effect: { kind: "cleanse-player-status-to-damage", status: "burn", damageType: "holy", lifesteal: true },
    expected: ["burn", "holy", "leech"],
  },
  {
    effect: { kind: "random-damage", minAmount: 1, maxAmount: 2, damageTypePool: ["burn", "holy"], lifesteal: true },
    expected: ["burn", "holy", "leech"],
  },
  {
    effect: { kind: "player-status", status: "block", statusPool: [], amount: 1, perManaCrystal: 0 },
    expected: ["mana"],
  },
  {
    effect: { kind: "player-status", status: "phoenixFeather", amount: 1 },
    expected: [],
  },
])("preserves optional keyword ordering and empty pools for $effect.kind", ({ effect, expected }) => {
  const before = structuredClone(effect);
  expect(collectKeywordsFromBattleEffects([effect])).toEqual(expected);
  expect(effect).toEqual(before);
});
