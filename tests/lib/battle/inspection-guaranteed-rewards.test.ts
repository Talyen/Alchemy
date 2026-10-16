import { describe, expect, it, vi } from "vitest";
import { cardById, type BattleCard, type KeywordId } from "@/lib/game-data";
import { strengthenPotion } from "@/lib/alchemist/brewing";
import { createMixedPotion } from "@/lib/alchemist";
import { getTransmutationVariants } from "@/lib/alchemist/transmutation";
import { getBattleDamageInspectionCard } from "@/lib/battle/card-damage-inspection";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { patchBattleState, type BattleStatePatch } from "../../fixtures/battle";

function acid(keyword: KeywordId) {
  const source = cardById["acid-potion"]!;
  return getTransmutationVariants(source, keyword, [source])[0]!.result;
}

function compare(card: BattleCard, patch: BattleStatePatch, amounts: number[]) {
  const rng = vi.fn(() => 0.99);
  const initial = patchBattleState({
    hand: [card],
    mana: 3,
    maxMana: 6,
    playerHealth: 18,
    playerMaxHealth: 40,
    enemyHealth: 999,
    enemyMaxHealth: 999,
    ...patch,
    rng,
  });
  const before = JSON.stringify(initial);
  const preview = getBattleDamageInspectionCard(card, initial);
  expect(rng).not.toHaveBeenCalled();
  expect(JSON.stringify(initial)).toBe(before);
  const actual = playBattleCardResolved(initial, card.id, 0);
  expect(
    actual.combatTexts
      .filter(
        (t) =>
          t.target === "enemy" && t.kind === "damage" && t.additive !== false && !["armor", "block"].includes(t.stat),
      )
      .reduce((sum, t) => sum + ("amount" in t ? t.amount : 0), 0),
  ).toBe(amounts.reduce((sum, amount) => sum + amount, 0));
  expect(preview.effects.flatMap((e) => (e.kind === "damage" ? [e.amount] : []))).toEqual(amounts);
}

describe("inspection projects guaranteed hit rewards", () => {
  it("includes Faith Barrier Block before a later Physical ingredient", () => {
    compare(
      createMixedPotion(acid("holy"), acid("physical")),
      {
        gearEffects: { blockOnHolyHitWithoutBlock: 4 },
        talentEffects: { blockToPhysicalDamageMultiplier: 1 },
      },
      [2, 6],
    );
  });
  it("includes Oathkeeper Block once across a multi-hit card", () => {
    compare(
      createMixedPotion(createMixedPotion(acid("holy"), strengthenPotion(acid("holy"))!), acid("physical")),
      {
        gearEffects: { oathkeeperHolyAndBlock: 1 },
        talentEffects: { blockToPhysicalDamageMultiplier: 1 },
      },
      [2, 3, 3],
    );
  });
  it("includes Nature Leech against Poison before a later low-health bonus", () => {
    compare(
      createMixedPotion(acid("nature"), acid("physical")),
      {
        playerHealth: 19,
        enemyStatuses: { poison: 1 },
        gearEffects: { natureLeechVsPoisoned: 1 },
        talentEffects: { physicalDoubledBelowHalfHealth: true },
      },
      [2, 2],
    );
  });
  it("includes Siphoning's Physical Leech before a later low-health bonus", () => {
    compare(
      createMixedPotion(acid("physical"), acid("bleed")),
      {
        playerHealth: 19,
        gearEffects: { physicalLeechBelowHalfHealth: 1 },
        talentEffects: { bleedDesperateMultiplier: 2 },
      },
      [2, 2],
    );
  });
  it("includes Overflow Mana after Leech restores full Health", () => {
    compare(
      createMixedPotion(acid("leech"), acid("burn")),
      {
        playerHealth: 39,
        talentEffects: { manaOnLeechToFull: 1, burnDamagePerMana: 100 },
      },
      [2, 5],
    );
  });
  it("includes Blessed Leech before a later low-health bonus", () => {
    compare(
      createMixedPotion(acid("holy"), acid("physical")),
      {
        playerHealth: 19,
        talentEffects: { holyLifestealPercent: 50, physicalDoubledBelowHalfHealth: true },
      },
      [2, 2],
    );
  });
  it("includes Second Wind recovery before Cull the Weak checks the next ingredient", () => {
    compare(
      createMixedPotion(acid("leech"), acid("physical")),
      {
        enemyHealth: 51,
        enemyMaxHealth: 100,
        currentEnemy: { traits: [{ id: "second-wind", title: "Second Wind", description: "" }] },
        talentEffects: { leechCardDamageVsLowHealthPercent: 25 },
      },
      [2, 2],
    );
  });
  it("includes Divine Aegis Armor in a later Kingbreaker hit", () => {
    const card = getTransmutationVariants(cardById["ray-of-frost"]!, "stun", [])[0]!.result;
    const rng = vi.fn(() => 0.99);
    const initial = patchBattleState({
      hand: [card],
      rng,
      enemyHealth: 51,
      enemyMaxHealth: 100,
      currentEnemy: { traits: [{ id: "divine-aegis", title: "Divine Aegis", description: "" }] },
      gearEffects: { armorIncreasesStun: 1 },
    });
    const preview = getBattleDamageInspectionCard(card, initial);
    expect(rng).not.toHaveBeenCalled();
    const actual = playBattleCardResolved(initial, card.id, 0);
    expect(actual.state.enemyHealth).toBe(50);
    expect(actual.state.flags.divineAegisTriggered).toBe(true);
    expect(preview.effects).toMatchObject([{ amount: 1 }, { amount: 3 }]);
  });
  it("removes Wardbreaker's purged Armor before a later Kingbreaker ingredient", () => {
    compare(
      createMixedPotion(cardById["acid-potion"]!, acid("stun")),
      {
        enemyMitigation: { armor: 8 },
        gearEffects: { attackPurgeOncePerTurn: 1, armorIncreasesStun: 1 },
      },
      [2, 2],
    );
  });
  it("removes Shattered defenses before a later Kingbreaker ingredient", () => {
    compare(
      createMixedPotion(acid("physical"), acid("stun")),
      {
        enemyMitigation: { armor: 8, block: 8 },
        enemyCC: { freezeSkipTurns: 1 },
        reactions: { shatterDamage: 1 },
        gearEffects: { armorIncreasesStun: 1 },
      },
      [2, 2],
    );
  });
});
