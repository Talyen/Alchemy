import { describe, expect, it } from "vitest";
import { applyGearKillRewards } from "@/lib/battle/kill-payouts";
import { gearFrozenDamageMultiplier, scaledGearLeechHeal } from "@/lib/battle/gear-effects";
import { applyGearDamageResistance, scaleGoldReward, type CombatTextEvent } from "@/lib/battle/types";
import { defaultGearEffects } from "@/lib/gear";
import { makeStateWithFailedRolls as makeState, makeTestCard, patchBattleState } from "../../fixtures/battle";
import { defaultCcState } from "../../fixtures/default-battle-state";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { computeCardDamageToEnemy } from "@/lib/battle/damage-calc";
import { processEnemyDamageEffect } from "@/lib/battle/enemy-attack-damage";
import { applyDamageRiders } from "@/lib/battle/damage-riders";
import { applyDamageStatuses, applyPoisonTalentRiders } from "@/lib/battle/damage-status-riders";
import { addEnemyStatus } from "@/lib/battle/types/state-helpers";
import { tickEnemyStatuses } from "@/lib/battle/status-ticks";
import { processCompanionTurnStart } from "@/lib/battle/companion";
import { resolvePlayerCrowdControlTrigger } from "@/lib/battle/status-cc";
import type { BattleCardEffect, EnemyAttackEffect } from "@/lib/game-data";

type DamageEffect = Extract<BattleCardEffect, { kind: "damage" }>;

function cardDamage(
  damageType: DamageEffect["damageType"],
  amount: number,
  extras: Partial<Omit<DamageEffect, "kind" | "damageType" | "amount">> = {},
): DamageEffect {
  return { kind: "damage", damageType, amount, ...extras };
}

function enemyDamage(amount: number): EnemyAttackEffect & { kind: "damage" } {
  return { kind: "damage", damageType: "physical", amount };
}

describe("gear-effects", () => {
  it("reduces incoming damage by gear resist percent", () => {
    const gear = { ...defaultGearEffects, resistPhysical: 50 };
    expect(applyGearDamageResistance(10, "physical", gear)).toBe(5);
    expect(applyGearDamageResistance(10, "burn", gear)).toBe(10);
  });

  it("scales gold rewards by goldGainPercent", () => {
    const gear = { ...defaultGearEffects, goldGainPercent: 25 };
    expect(scaleGoldReward(100, gear)).toBe(125);
    expect(scaleGoldReward(100, defaultGearEffects)).toBe(100);
  });

  it("scales leech heal by leechHealBonusPercent", () => {
    const gear = { ...defaultGearEffects, leechHealBonusPercent: 50 };
    expect(scaledGearLeechHeal(4, gear)).toBe(6);
  });

  it("applies frozen enemy damage bonus multiplier", () => {
    const state = patchBattleState({
      enemyCC: defaultCcState({ freezeSkipTurns: 1 }),
      gearEffects: { ...defaultGearEffects, frozenEnemyDamageBonusPercent: 50 },
    });
    expect(gearFrozenDamageMultiplier(state)).toBe(1.5);
    expect(gearFrozenDamageMultiplier(patchBattleState({ enemyCC: defaultCcState({ freezeSkipTurns: 0 }) }))).toBe(1);
  });

  it("applies kill rewards with scaled gold", () => {
    const state = patchBattleState({
      enemyHealth: 0,
      gold: 5,
      playerHealth: 10,
      gearEffects: { ...defaultGearEffects, healOnKill: 3, goldOnKill: 4, goldGainPercent: 50 },
    });
    const texts: Parameters<typeof applyGearKillRewards>[2] = [];
    const next = applyGearKillRewards(state, true, texts);
    expect(next.playerHealth).toBe(13);
    expect(next.gold).toBe(11);
    expect(texts.some((t) => t.kind === "heal")).toBe(true);
    expect(texts.some((t) => t.stat === "gold" && (t as { amount: number }).amount === 6)).toBe(true);
  });

  it("burn-on-consume: applies Burn when a card is Consumed", () => {
    const card = makeTestCard({ id: "card-consume", consume: true });
    const state = makeState({
      hand: [card],
      gearEffects: { ...makeState().gearEffects, burnOnConsume: 5 },
    });
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state.enemyStatuses.burn).toBe(5);
  });

  it("archery-ignore-armor: ignores enemy Armor on archery attacks", () => {
    const effect = cardDamage("physical", 10);
    const card = makeTestCard({
      id: "card-archery",
      tags: ["archery"],
      effects: [effect],
    });
    const state = makeState({
      hand: [card],
      enemyMitigation: { ...makeState().enemyMitigation, armor: 5 },
      gearEffects: { ...makeState().gearEffects, archeryArmorPiercing: 3 },
      rng: () => 0.5,
    });
    const result = computeCardDamageToEnemy(state, effect, card);
    expect(result.modifiedDamage).toBe(8);
    expect(result.nextState.enemyMitigation.armor).toBe(2);
  });

  it("absorb-per-mana: reduces incoming damage before block", () => {
    const state = makeState({
      mana: 3,
      playerStatuses: { ...makeState().playerStatuses, block: 10 },
      gearEffects: { ...makeState().gearEffects, damageReductionPerMana: 2 },
    });
    const texts: CombatTextEvent[] = [];
    const nextState = processEnemyDamageEffect(state, enemyDamage(10), texts);
    expect(nextState.playerStatuses.block).toBe(6);
    expect(nextState.playerHealth).toBe(state.playerHealth);
  });

  it("heal-on-burn-death: restores health when enemy with Burn dies", () => {
    const state = makeState({
      enemyHealth: 0,
      playerHealth: 5,
      playerMaxHealth: 10,
      enemyStatuses: { ...makeState().enemyStatuses, burn: 3 },
      gearEffects: { ...makeState().gearEffects, healOnBurnEnemyDefeated: 4 },
    });
    const texts: CombatTextEvent[] = [];
    const nextState = applyGearKillRewards(state, true, texts);
    expect(nextState.playerHealth).toBe(9);
  });

  it("mana-on-leech-chance: chance to restore 1 mana on Leech", () => {
    const effect = cardDamage("physical", 10, { lifesteal: true });
    const card = makeTestCard({
      id: "card-lifesteal",
      effects: [effect],
    });
    const state = makeState({
      mana: 1,
      maxMana: 3,
      gearEffects: { ...makeState().gearEffects, manaOnLeechChance: 100 },
      rng: () => 0.1,
    });
    const texts: CombatTextEvent[] = [];
    const nextState = applyDamageRiders(state, card, effect, 10, texts);
    expect(nextState.mana).toBe(2);
  });

  it("poison-reduces-armor: every poison application shreds exactly once, ticks never do", () => {
    const state1 = makeState({
      enemyMitigation: { ...makeState().enemyMitigation, armor: 5 },
      gearEffects: { ...makeState().gearEffects, poisonArmorShredChance: 100 },
      rng: () => 0.1,
    });
    const texts1: CombatTextEvent[] = [];
    const resultState1 = applyDamageStatuses(state1, cardDamage("poison", 4), 4, texts1);
    expect(resultState1.enemyStatuses.poison).toBe(4);
    expect(resultState1.enemyMitigation.armor).toBe(4);

    const state2 = makeState({
      enemyMitigation: { ...makeState().enemyMitigation, armor: 5 },
      gearEffects: { ...makeState().gearEffects, poisonArmorShredChance: 100 },
      rng: () => 0.1,
    });
    const applied = addEnemyStatus(state2, "poison", 4);
    expect(applied.enemyStatuses.poison).toBe(4);
    expect(applied.enemyMitigation.armor).toBe(4);

    const state3 = makeState({
      enemyMitigation: { ...makeState().enemyMitigation, armor: 5 },
      gearEffects: { ...makeState().gearEffects, poisonArmorShredChance: 100 },
      rng: () => 0.1,
    });
    const texts3: CombatTextEvent[] = [];
    const resultState3 = applyPoisonTalentRiders(state3, 5, texts3);
    expect(resultState3.enemyMitigation.armor).toBe(5);
  });

  it("nature-mana-refund-chance: refunds 1 mana on Nature damage card play", () => {
    const card = makeTestCard({
      id: "card-nature",
      cost: 1,
      effects: [cardDamage("nature", 10)],
    });
    const state = makeState({
      mana: 3,
      maxMana: 3,
      hand: [card],
      gearEffects: { ...makeState().gearEffects, manaOnNatureDamageChance: 100 },
      rng: () => 0.1,
    });
    const result = playBattleCardResolved(state, card.id, 0);
    expect(result.state.mana).toBe(3);
  });

  it("burn-on-bleed: burn deals more damage to bleeding enemies on play and tick", () => {
    const effect = cardDamage("burn", 10);
    const card = makeTestCard({
      id: "card-burn",
      effects: [effect],
    });
    const state1 = makeState({
      enemyStatuses: { ...makeState().enemyStatuses, bleed: 3 },
      gearEffects: { ...makeState().gearEffects, burnDamageBonusToBleedingPercent: 50 },
      rng: () => 0.5,
    });
    const result1 = computeCardDamageToEnemy(state1, effect, card);
    expect(result1.modifiedDamage).toBe(15);

    const state2 = makeState({
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyStatuses: { ...makeState().enemyStatuses, burn: 10, bleed: 3 },
      gearEffects: { ...makeState().gearEffects, burnDamageBonusToBleedingPercent: 50 },
    });
    const texts: CombatTextEvent[] = [];
    const result2 = tickEnemyStatuses(state2, texts);
    expect(result2.enemyHealth).toBe(82);
  });

  it("stun-on-block-hit: deals stun when player block is depleted", () => {
    const state = makeState({
      playerStatuses: { ...makeState().playerStatuses, block: 2 },
      gearEffects: { ...makeState().gearEffects, stunOnBlockDepleted: 6 },
    });
    const texts: CombatTextEvent[] = [];
    const nextState = processEnemyDamageEffect(state, enemyDamage(5), texts);
    expect(nextState.playerStatuses.block).toBe(0);
    expect(nextState.enemyHealth).toBe(state.enemyHealth - 6);
    expect(nextState.enemyStatuses.stun).toBe(6);
  });

  it("companion-leech: heals player when companion attacks", () => {
    const state = makeState({
      playerHealth: 5,
      playerMaxHealth: 10,
      activeCompanion: {
        id: "wolf",
        title: "Wolf",
        art: "wolf",
        turnStartEffects: [cardDamage("physical", 2)],
      },
      gearEffects: { ...makeState().gearEffects, healOnCompanionAttack: 3 },
    });
    const texts: CombatTextEvent[] = [];
    const nextState = processCompanionTurnStart(state, texts);
    expect(nextState.playerHealth).toBe(8);
  });

  it("armor-on-cc: grants armor when player is stunned or frozen", () => {
    const state = makeState({
      playerStatuses: { ...makeState().playerStatuses, armor: 0 },
      gearEffects: { ...makeState().gearEffects, armorOnStunOrFreeze: 4 },
    });
    const nextState = resolvePlayerCrowdControlTrigger({
      state,
      stat: "stun",
      stackValue: 60,
      thresholdFraction: 0.5,
      combatTexts: [],
    });
    expect(nextState.playerStatuses.armor).toBe(4);
  });
});
