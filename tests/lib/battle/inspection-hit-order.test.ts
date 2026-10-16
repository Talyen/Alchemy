import { describe, expect, it, vi } from "vitest";
import { cardById, type BattleCard, type KeywordId } from "@/lib/game-data";
import { getTransmutationVariants } from "@/lib/alchemist/transmutation";
import { strengthenPotion } from "@/lib/alchemist/brewing";
import { createMixedPotion } from "@/lib/alchemist";
import { applyNumericCorruption, getEditableCorruptionTargets } from "@/lib/corruption/numeric";
import { getBattleDamageInspectionCard } from "@/lib/battle/card-damage-inspection";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { patchBattleState, type BattleStatePatch } from "../../fixtures/battle";

function transmute(source: string | BattleCard, keyword: KeywordId): BattleCard {
  const card = typeof source === "string" ? cardById[source]! : source;
  return getTransmutationVariants(card, keyword, [card])[0]!.result;
}

function distillAcid(times: number): BattleCard {
  let card = cardById["acid-potion"]!;
  for (let index = 0; index < times; index++) card = strengthenPotion(card)!;
  return card;
}

function compareDamage(card: BattleCard, patch: BattleStatePatch, expected: number[]) {
  const rng = vi.fn(() => 0.99);
  const initial = patchBattleState({
    hand: [card],
    mana: 10,
    maxMana: 10,
    playerHealth: 30,
    playerMaxHealth: 40,
    enemyHealth: 999,
    enemyMaxHealth: 999,
    ...patch,
    rng,
  });
  const before = JSON.stringify({ initial, card });
  const preview = getBattleDamageInspectionCard(card, initial);
  expect(rng).not.toHaveBeenCalled();
  expect(JSON.stringify({ initial, card })).toBe(before);
  const actual = playBattleCardResolved(initial, card.id, 0);
  const projected = preview.effects.flatMap((effect) => (effect.kind === "damage" ? [effect.amount] : []));
  const dealt = actual.combatTexts.reduce(
    (sum, event) =>
      sum +
      (event.target === "enemy" &&
      event.kind === "damage" &&
      event.stat !== "armor" &&
      event.stat !== "block" &&
      "amount" in event
        ? event.amount
        : 0),
    0,
  );
  expect(dealt).toBe(expected.reduce((sum, amount) => sum + amount, 0));
  expect(projected).toEqual(expected);
}

describe("damage inspection follows earlier card effects", () => {
  it("uses Renewal healing before Cauterize checks Unrelenting", () => {
    compareDamage(
      transmute("cauterize", "physical"),
      {
        playerHealth: 19,
        playerStatuses: { burn: 4, forge: 5 },
        talentEffects: { healOnStatusCleanse: 2, physicalDoubledBelowHalfHealth: true },
      },
      [6],
    );
  });

  it("removes Exorcism's stored Burn when its self-hit triggers Last Resort", () => {
    const original = cardById.exorcism!;
    const target = getEditableCorruptionTargets(original)[0]!;
    const card = applyNumericCorruption(original, target, 1);
    compareDamage(
      card,
      { playerHealth: 11, playerStatuses: { burn: 5 }, talentEffects: { cleanseBelowHealthPercent: 25 } },
      [0],
    );
  });

  it("uses an ingredient's Leech healing before the next ingredient's Physical hit", () => {
    const card = createMixedPotion(transmute("acid-potion", "leech"), transmute("acid-potion", "physical"));
    compareDamage(card, { playerHealth: 19, talentEffects: { physicalDoubledBelowHalfHealth: true } }, [2, 2]);
  });

  it("decays enemy Armor between Kingbreaker's consecutive hits", () => {
    compareDamage(
      transmute("ray-of-frost", "stun"),
      { enemyMitigation: { armor: 10 }, gearEffects: { armorIncreasesStun: 1 } },
      [11, 10],
    );
  });

  it("enables Corrosive after the first Poison hit", () => {
    compareDamage(transmute("ray-of-frost", "poison"), { talentEffects: { poisonDamageBonusVsPoisoned: 1 } }, [1, 2]);
  });

  it("enables Purge after a prior ingredient ignites the enemy", () => {
    const card = createMixedPotion(transmute("acid-potion", "burn"), transmute(distillAcid(3), "holy"));
    compareDamage(card, { talentEffects: { holyVsBurnMultiplier: 10 } }, [2, 6]);
  });

  it("spends First Blood's unbled opening before the second Bleed ingredient", () => {
    const card = createMixedPotion(transmute("acid-potion", "bleed"), transmute(distillAcid(2), "bleed"));
    compareDamage(card, { talentEffects: { bleedUnwoundedBonusPercent: 25 } }, [3, 4]);
  });
});
