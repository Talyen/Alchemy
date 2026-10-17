import { describe, expect, it, vi } from "vitest";
import { cardById, companionLibrary, type BattleCard, type BattleCardEffect, type KeywordId } from "@/lib/game-data";
import { createMixedPotion } from "@/lib/alchemist";
import { getTransmutationVariants } from "@/lib/alchemist/transmutation";
import { getBattleDamageInspectionCard } from "@/lib/battle/card-damage-inspection";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { makeTestCard, patchBattleState, type BattleStatePatch } from "../../fixtures/battle";

function acid(keyword: KeywordId): BattleCard {
  const card = cardById["acid-potion"]!;
  return getTransmutationVariants(card, keyword, [card])[0]!.result;
}

function compare(card: BattleCard, patch: BattleStatePatch, expected: number[]) {
  const rng = vi.fn(() => 0.99);
  const state = patchBattleState({
    hand: [card],
    rng,
    mana: 3,
    maxMana: 10,
    gold: 0,
    playerHealth: 19,
    playerMaxHealth: 40,
    enemyHealth: 100,
    enemyMaxHealth: 100,
    ...patch,
  });
  const before = JSON.stringify({ card, state });
  const preview = getBattleDamageInspectionCard(card, state);
  expect(rng).not.toHaveBeenCalled();
  expect(JSON.stringify({ card, state })).toBe(before);
  const result = playBattleCardResolved(state, card.id, 0);
  // These recipes have distinct damage types; reactions may add later damage of the same type.
  const actual = card.effects.flatMap((effect) =>
    effect.kind === "damage"
      ? [
          result.combatTexts.find(
            (text) => text.target === "enemy" && text.kind === "damage" && text.stat === effect.damageType,
          ),
        ]
      : [],
  );
  expect(actual.map((text) => (text && "amount" in text ? text.amount : null))).toEqual(expected);
  expect(preview.effects.flatMap((effect) => (effect.kind === "damage" ? [effect.amount] : []))).toEqual(expected);
}

describe("inspection follows resource rewards between ingredients", () => {
  it("includes guaranteed Leech Block before a Physical ingredient", () => {
    compare(
      createMixedPotion(acid("leech"), acid("physical")),
      {
        gearEffects: { leechBlockChance: 100 },
        talentEffects: { blockToPhysicalDamageMultiplier: 1 },
      },
      [2, 3],
    );
  });

  it("includes guaranteed Mana Siphon before a Burn ingredient", () => {
    compare(
      createMixedPotion(acid("leech"), acid("burn")),
      {
        gearEffects: { manaOnLeechChance: 100 },
        talentEffects: { burnDamagePerMana: 100 },
      },
      [2, 5],
    );
  });

  it("includes guaranteed Nature Mana refunds before a Burn ingredient", () => {
    compare(
      createMixedPotion(acid("nature"), acid("burn")),
      {
        gearEffects: { manaOnNatureDamageChance: 100 },
        talentEffects: { burnDamagePerMana: 100 },
      },
      [2, 5],
    );
  });

  it("does not promise fractional Leech rewards or draw RNG while inspecting them", () => {
    compare(
      createMixedPotion(acid("leech"), acid("burn")),
      {
        gearEffects: { manaOnLeechChance: 50, leechBlockChance: 50 },
        talentEffects: { burnDamagePerMana: 100 },
      },
      [2, 4],
    );
  });

  it("includes Bloodfire's guaranteed Leech against a Burning and Bleeding enemy", () => {
    compare(
      createMixedPotion(acid("burn"), acid("physical")),
      {
        enemyStatuses: { burn: 1, bleed: 1 },
        gearEffects: { burnBleedMirrorAndLeech: 1 },
        talentEffects: { physicalDoubledBelowHalfHealth: true },
      },
      [2, 2],
    );
  });

  it("includes Cutpurse's Gold before a Holy ingredient scales from the purse", () => {
    compare(
      createMixedPotion(acid("bleed"), acid("holy")),
      {
        trinketEffects: { cutpurseGoldOnBleed: 1 },
        talentEffects: { holyGoldPercent: 100 },
      },
      [2, 3],
    );
  });
});

describe("inspection follows guaranteed hit rewards", () => {
  it.each<{
    name: string;
    effects: BattleCardEffect[];
    patch: BattleStatePatch;
    expected: number[];
  }>([
    {
      name: "Thornskin Armor before an Armor-scaled attack",
      effects: [
        { kind: "damage", damageType: "nature", amount: 4 },
        { kind: "damage", damageType: "physical", amount: 0, equalToArmor: true },
      ],
      patch: { talentEffects: { armorOnNatureDamageChance: 100 } },
      expected: [4, 4],
    },
    {
      name: "Photosynthesis before a low-Health Physical attack",
      effects: [
        { kind: "damage", damageType: "nature", amount: 4 },
        { kind: "damage", damageType: "physical", amount: 3 },
      ],
      patch: { talentEffects: { healOnNatureDamageChance: 100, physicalDoubledBelowHalfHealth: true } },
      expected: [4, 3],
    },
    {
      name: "Verdant Cycle before a low-Health Physical attack",
      effects: [
        { kind: "damage", damageType: "nature", amount: 4 },
        { kind: "damage", damageType: "physical", amount: 3 },
      ],
      patch: { talentEffects: { natureLeechChance: 100, physicalDoubledBelowHalfHealth: true } },
      expected: [4, 3],
    },
    {
      name: "Virulent Leech before a low-Health Physical attack",
      effects: [
        { kind: "damage", damageType: "poison", amount: 4 },
        { kind: "damage", damageType: "physical", amount: 3 },
      ],
      patch: { talentEffects: { poisonLeechChance: 100, physicalDoubledBelowHalfHealth: true } },
      expected: [4, 3],
    },
    {
      name: "Faith Barrier before Block-scaled Physical damage",
      effects: [
        { kind: "damage", damageType: "holy", amount: 4 },
        { kind: "damage", damageType: "physical", amount: 0, equalToBlock: true },
      ],
      patch: { talentEffects: { holyBlockChance: 100 } },
      expected: [4, 4],
    },
    {
      name: "Tithe healing before a low-Health Physical attack",
      effects: [
        { kind: "damage", damageType: "holy", amount: 4 },
        { kind: "damage", damageType: "physical", amount: 3 },
      ],
      patch: {
        talentEffects: { holyGoldChance: 100, physicalDoubledBelowHalfHealth: true },
        gearEffects: { healOnCombatGoldGain: 2 },
      },
      expected: [4, 3],
    },
    {
      name: "Flay before Kingbreaker damage",
      effects: [
        { kind: "damage", damageType: "bleed", amount: 2 },
        { kind: "damage", damageType: "stun", amount: 2 },
      ],
      patch: {
        enemyMitigation: { armor: 7 },
        talentEffects: { bleedHalveArmorChance: 100 },
        gearEffects: { armorIncreasesStun: 1 },
      },
      expected: [2, 5],
    },
  ])("$name", ({ effects, patch, expected }) => compare(makeTestCard({ effects }), patch, expected));

  it("retains resources shared by both chance branches before the next attack", () => {
    const grant: BattleCardEffect = { kind: "player-status", status: "block", amount: 4 };
    compare(
      makeTestCard({
        effects: [
          { kind: "chance", probability: 0.5, successEffects: [grant], failureEffects: [{ ...grant }] },
          { kind: "damage", damageType: "physical", amount: 0, equalToBlock: true },
        ],
      }),
      {},
      [4],
    );
  });
});

it("Rimeheart does not pace its already-paced Block a second time", () => {
  compare(
    makeTestCard({
      effects: [
        { kind: "damage", damageType: "freeze", amount: 4 },
        { kind: "damage", damageType: "physical", amount: 0, equalToBlock: true },
      ],
    }),
    { appliesFightPacing: true, turn: 13, playerHealth: 40, gearEffects: { freezeGrantsBlockAndMana: 1 } },
    [15, 54],
  );
});

it("Lizard Scout's Caustic damage strips Armor before Kingbreaker damage", () => {
  compare(
    makeTestCard({
      effects: [
        { kind: "companion-action", amount: 1 },
        { kind: "damage", damageType: "stun", amount: 2 },
      ],
    }),
    {
      activeCompanion: companionLibrary["lizard-scout"],
      enemyMitigation: { armor: 7 },
      talentEffects: { poisonStripArmorByDamage: true },
      gearEffects: { armorIncreasesStun: 1 },
    },
    [7],
  );
});
