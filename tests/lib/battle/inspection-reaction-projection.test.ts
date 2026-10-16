import { describe, expect, it, vi } from "vitest";
import { getBattleDamageInspectionCard } from "@/lib/battle/card-damage-inspection";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { cardById, type BattleCard, type KeywordId } from "@/lib/game-data";
import { createMixedPotion } from "@/lib/alchemist";
import { getTransmutationVariants } from "@/lib/alchemist/transmutation";
import { getCorruptionMutationGroups } from "@/lib/corruption/mutations";
import { regressionBattle, type BattleStatePatch } from "../../fixtures/battle";

function acid(keyword: KeywordId) {
  return getTransmutationVariants(cardById["acid-potion"]!, keyword, [])[0]!.result;
}
function secondary(id: string, type: "burn" | "poison") {
  return getCorruptionMutationGroups(cardById[id]!)
    .find((group) => group.kind === "secondary")!
    .mutations.find(({ card }) => card.effects.some((e) => e.kind === "damage" && e.damageType === type))!.card;
}
function compare(
  card: BattleCard,
  patch: BattleStatePatch,
  index: number,
  amount: number,
  actualStat: string,
  actualAmount = amount,
) {
  const rng = vi.fn(() => 0.99);
  const state = regressionBattle({
    hand: [card],
    playerHealth: 50,
    playerMaxHealth: 100,
    enemyHealth: 100,
    enemyMaxHealth: 100,
    mana: 3,
    maxMana: 6,
    ...patch,
    rng,
  });
  const before = JSON.stringify(state);
  const preview = getBattleDamageInspectionCard(card, state);
  expect(rng).not.toHaveBeenCalled();
  expect(JSON.stringify(state)).toBe(before);
  const played = playBattleCardResolved(state, card.id, 0);
  const damage = played.combatTexts
    .filter((t) => t.target === "enemy" && t.kind === "damage" && t.additive !== false && t.stat === actualStat)
    .reduce((sum, text) => sum + ("amount" in text ? text.amount : 0), 0);
  expect(damage).toBe(actualAmount);
  expect(preview.effects[index]).toMatchObject({ kind: "damage", amount });
  return played;
}

describe("inspection follows deterministic combat reactions", () => {
  it("Freezing with the first Ray of Frost packet strengthens the second", () => {
    compare(
      cardById["ray-of-frost"]!,
      { enemyHealth: 6, gearEffects: { frozenEnemyDamageBonusPercent: 20 }, talentEffects: { flatFreezeDamage: 2 } },
      1,
      4,
      "freeze",
      7,
    );
  });
  it("Stun Surge restores Mana before a later Burn ingredient", () => {
    compare(
      createMixedPotion(acid("stun"), acid("burn")),
      {
        mana: 1,
        enemyHealth: 4,
        gearEffects: { manaOnStun: 1 },
        talentEffects: { manaOnStun: 1, burnDamagePerMana: 25 },
      },
      3,
      3,
      "burn",
    );
  });
  it("Cold Snap multiplication can Freeze before its corrupted Burn hit", () => {
    compare(
      secondary("cold-snap", "burn"),
      {
        enemyHealth: 8,
        enemyStatuses: { freeze: 1 },
        gearEffects: { frozenEnemyDamageBonusPercent: 20 },
        talentEffects: { flatBurnDamage: 2 },
      },
      2,
      4,
      "burn",
    );
  });
  it("Hemorrhage clears Bleed before Bloodember applies First Blood to Burn", () => {
    compare(
      secondary("hemorrhage", "burn"),
      {
        enemyStatuses: { bleed: 1 },
        gearEffects: { sharedBurnBleedBonuses: 1 },
        talentEffects: { bleedUnwoundedBonusPercent: 25, flatBurnDamage: 1 },
      },
      1,
      3,
      "burn",
    );
  });
  it("Combustion can end combat before a corrupted Poison hit", () => {
    compare(secondary("combustion", "poison"), { enemyHealth: 3, enemyStatuses: { burn: 2 } }, 1, 0, "poison");
  });
  it("Wishwoven restores Mana before a corrupted Wish card deals Burn", () => {
    compare(
      secondary("wish", "burn"),
      { mana: 1, gearEffects: { manaOnWish: 2 }, talentEffects: { burnDamagePerMana: 25 } },
      1,
      2,
      "burn",
    );
  });
  it("Heartshock Stuns after Leech before the next ingredient", () => {
    compare(
      createMixedPotion(acid("leech"), acid("burn")),
      {
        playerHealth: 20,
        enemyHealth: 12,
        gearEffects: { stunOnLeechBelowHalfHealth: 6, poisonArmorShredChance: 25 },
        talentEffects: { stunDoubleDamage: true },
      },
      3,
      4,
      "burn",
    );
  });
  it("fatal Cinder Skin retaliation prevents a later ingredient", () => {
    const played = compare(
      createMixedPotion(acid("physical"), acid("burn")),
      {
        playerHealth: 1,
        deathsDoorUsed: true,
        currentEnemy: { traits: [{ id: "cinder-skin", title: "Cinder Skin", description: "" }] },
      },
      3,
      0,
      "burn",
    );
    expect(played.state.playerHealth).toBe(0);
  });
  it("Blood Countess healing damage can end combat before the card hit", () => {
    compare(
      secondary("heal", "burn"),
      {
        playerHealth: 10,
        enemyHealth: 1,
        currentEnemy: { traits: [{ id: "blood-countess", title: "Blood Countess", description: "" }] },
      },
      1,
      0,
      "burn",
    );
  });
  it("Opening can end combat before the next Potion ingredient", () => {
    compare(
      createMixedPotion(cardById["acid-potion"]!, acid("burn")),
      { enemyHealth: 3, flags: { nextHitPhysicalBonus: 1 } },
      4,
      0,
      "burn",
    );
  });
});
