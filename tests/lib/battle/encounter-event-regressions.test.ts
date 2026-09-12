import { describe, expect, it } from "vitest";
import { cardById, cardLibrary, type BattleCard } from "@/lib/game-data";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { advanceToPlayerTurn } from "@/lib/battle/player-turn-transition";
import { resolveEnemyAttackHit } from "@/lib/battle/enemy-attack-hit";
import { buildWishOptions } from "@/lib/battle/wish";
import { BattleCardEffectSchema } from "@/lib/game-data";
import { applyNumericCorruption, getEditableCorruptionTargets } from "@/lib/corruption/numeric";
import { patchBattleState } from "../../fixtures/battle";

function battle(trait: string) {
  return patchBattleState({
    currentEnemy: { traits: [{ id: trait, title: trait, description: "" }] },
    enemyHealth: 100,
    enemyMaxHealth: 100,
    playerHealth: 10,
    playerMaxHealth: 40,
    rng: () => 0.99,
  });
}

describe("encounter event regressions", () => {
  it("Jealous reacts when Stargaze's delayed Wish resolves", () => {
    const card = cardById.stargaze!;
    const played = playBattleCardResolved({ ...battle("jealous"), hand: [card] }, card.id, 0).state;
    expect(played.enemyPhysicalDamageBonus).toBe(0);
    const next = advanceToPlayerTurn(played);
    expect(next.wishOptions).not.toBeNull();
    expect(next.enemyPhysicalDamageBonus).toBe(1);
  });

  it("Dance of Blades feeds Insatiable when it consumes a Potion", () => {
    const state = battle("insatiable");
    const result = resolveEnemyAttackHit(
      {
        ...state,
        deck: [cardById["health-potion"]!],
        gearEffects: { ...state.gearEffects, dodgeDrawAndPlay: 1 },
        rng: () => 0,
      },
      { kind: "damage", damageType: "physical", amount: 1 },
      [],
      { canDodge: true },
    ).state;
    expect(result.exhausted.map((card) => card.id)).toContain("health-potion");
    expect(result.enemyPhysicalDamageBonus).toBe(1);
  });

  it.each([0.25, 0.75])("Holy Retribution follows a legacy Roll the Dice's resolved branch (%s)", (roll) => {
    const card: BattleCard = {
      ...cardById["roll-the-dice"]!,
      consume: false,
      descriptionLines: ["Deal 3 Random damage or gain 3 Gold"],
      effects: [
        {
          kind: "chance",
          probability: 0.5,
          successEffects: [{ kind: "random-damage", minAmount: 3, maxAmount: 3 }],
          failureEffects: [{ kind: "gain-gold", amount: 3 }],
        },
      ],
    };
    const result = playBattleCardResolved(
      { ...battle("holy-retribution"), hand: [card], rng: () => roll },
      card.id,
      0,
    ).state;
    expect(result.playerHealth).toBe(roll < 0.5 ? 9 : 10);
  });

  it.each([true, false])("automatic Consume rewards respect survival with Death's Door spent: %s", (spent) => {
    const state = battle("holy-retribution");
    const result = resolveEnemyAttackHit(
      {
        ...state,
        playerHealth: 1,
        deathsDoorUsed: spent,
        deck: [cardById["acid-potion"]!],
        gearEffects: { ...state.gearEffects, dodgeDrawAndPlay: 1 },
        talentEffects: { ...state.talentEffects, goldOnConsume: 1 },
        rng: () => 0,
      },
      { kind: "damage", damageType: "physical", amount: 1 },
      [],
      { canDodge: true },
    ).state;
    expect(result.playerHealth).toBe(spent ? 0 : 1);
    expect(result.deathsDoorActive).toBe(!spent);
    expect(result.gold - state.gold).toBe(spent ? 0 : 1);
    expect(result.exhausted.map((card) => card.id)).toContain("acid-potion");
  });

  it.each([10, 39])("Finish Him's incidental Leech at %s Health does not receive card-only bonuses", (health) => {
    const card = cardById.slash!;
    const state = battle("none");
    const result = playBattleCardResolved(
      {
        ...state,
        playerHealth: health,
        playerStatuses: { ...state.playerStatuses, poison: 2 },
        enemyCC: { ...state.enemyCC, stunSkipTurns: 1 },
        talentEffects: {
          ...state.talentEffects,
          physicalLeechVsStunned: true,
          cardLeechBonusPercent: 25,
          cleanseOnCardOverheal: true,
        },
        hand: [card],
      },
      card.id,
      0,
    ).state;
    expect(result.playerHealth).toBe(Math.min(40, health + 3));
    expect(result.playerStatuses.poison).toBe(2);
  });

  it("Powerful Wish upgrades every Luck Potion outcome", () => {
    const state = battle("none");
    const options = buildWishOptions(
      {
        ...state,
        talentEffects: { ...state.talentEffects, wishCardsUpgraded: true, wishExtraChoices: cardLibrary.length },
      },
      cardById.wish!,
    );
    const potion = options.find((card) => card.id === "luck-potion")!;
    expect(potion.descriptionLines[0]).toBe("Gain 5 Mana or gain 5 Gold or gain 5 Block");
    expect(JSON.stringify(potion.effects)).not.toContain('"amount":4');
    const dice = options.find((card) => card.id === "roll-the-dice")!;
    expect(dice.descriptionLines).toEqual(cardById["roll-the-dice"]!.descriptionLines);
    expect(dice.effects.every((effect) => BattleCardEffectSchema.safeParse(effect).success)).toBe(true);
    expect(dice.effects).toEqual([{ kind: "random-draw", minAmount: 1, maxAmount: 6 }]);
    const original = cardById["luck-potion"]!;
    const target = getEditableCorruptionTargets(original).at(-1)!;
    const corrupted = applyNumericCorruption(original, target, 1);
    expect(corrupted.descriptionLines[0]).toBe("Gain 4 Mana or gain 4 Gold or gain 5 Block");
    expect(original.descriptionLines[0]).toBe("Gain 4 Mana or gain 4 Gold or gain 4 Block");
  });
});
