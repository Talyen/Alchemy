import { describe, expect, it } from "vitest";
import { makeTestBattleState, makeTestCard } from "../../fixtures/battle";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { computeCardDamageToEnemy } from "@/lib/battle/damage-calc";
import { processEnemyDamageEffect } from "@/lib/battle/enemy-turn-attack";
import { applyGearKillRewards } from "@/lib/battle/gear-effects";
import { applyDamageRiders } from "@/lib/battle/damage-riders";
import { addEnemyStatus } from "@/lib/battle/types";
import { applyPoisonTalentRiders } from "@/lib/battle/damage-status-riders";
import { tickEnemyStatuses } from "@/lib/battle/status-ticks";
import { processCompanionTurnStart } from "@/lib/battle/companion";
import { resolvePlayerCrowdControlTrigger } from "@/lib/battle/status-cc";

function makeState(overrides: Parameters<typeof makeTestBattleState>[0] = {}) {
  return makeTestBattleState({ rng: () => 0.99, ...overrides });
}

describe("New Gear Affixes Integration Tests", () => {
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
    const card = makeTestCard({
      id: "card-archery",
      tags: ["archery"],
      effects: [{ kind: "damage", damageType: "physical", amount: 10 }],
    });
    const state = makeState({
      hand: [card],
      enemyMitigation: { ...makeState().enemyMitigation, armor: 5 },
      gearEffects: { ...makeState().gearEffects, archeryArmorPiercing: 3 },
      rng: () => 0.5,
    });
    const result = computeCardDamageToEnemy(state, card.effects[0] as any, card);
    expect(result.modifiedDamage).toBe(8);
    expect(result.nextState.enemyMitigation.armor).toBe(2);
  });

  it("absorb-per-mana: reduces incoming damage before block", () => {
    const state = makeState({
      mana: 3,
      playerStatuses: { ...makeState().playerStatuses, block: 10 },
      gearEffects: { ...makeState().gearEffects, damageReductionPerMana: 2 },
    });
    const effect = { kind: "damage" as const, damageType: "physical" as const, amount: 10 };
    const texts: any[] = [];
    const nextState = processEnemyDamageEffect(state, effect, texts);
    // absorb: 2 * 3 = 6. incoming damage: 10 - 6 = 4.
    // block absorbs 4, so block goes from 10 to 6, health remains full.
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
    const texts: any[] = [];
    const nextState = applyGearKillRewards(state, true, texts);
    expect(nextState.playerHealth).toBe(9);
  });

  it("mana-on-leech-chance: chance to restore 1 mana on Leech", () => {
    const card = makeTestCard({
      id: "card-lifesteal",
      effects: [{ kind: "damage", damageType: "physical", amount: 10, lifesteal: true }],
    });
    const state = makeState({
      mana: 1,
      maxMana: 3,
      gearEffects: { ...makeState().gearEffects, manaOnLeechChance: 100 },
      rng: () => 0.1, // roll succeeds
    });
    const texts: any[] = [];
    const nextState = applyDamageRiders(state, card, card.effects[0] as any, 10, texts);
    expect(nextState.mana).toBe(2);
  });

  it("poison-reduces-armor: reduces enemy Armor on poison application and tick", () => {
    // 1. Application
    const state1 = makeState({
      enemyMitigation: { ...makeState().enemyMitigation, armor: 5 },
      gearEffects: { ...makeState().gearEffects, poisonArmorShredChance: 100 },
      rng: () => 0.1,
    });
    const resultState1 = addEnemyStatus(state1, "poison", 2);
    expect(resultState1.enemyMitigation.armor).toBe(4);

    // 2. Tick
    const state2 = makeState({
      enemyMitigation: { ...makeState().enemyMitigation, armor: 5 },
      gearEffects: { ...makeState().gearEffects, poisonArmorShredChance: 100 },
      rng: () => 0.1,
    });
    const texts: any[] = [];
    const resultState2 = applyPoisonTalentRiders(state2, 5, texts);
    expect(resultState2.enemyMitigation.armor).toBe(4);
  });

  it("nature-mana-refund-chance: refunds 1 mana on Nature damage card play", () => {
    const card = makeTestCard({
      id: "card-nature",
      cost: 1,
      effects: [{ kind: "damage", damageType: "nature", amount: 10 }],
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
    // 1. Play
    const card = makeTestCard({
      id: "card-burn",
      effects: [{ kind: "damage", damageType: "burn", amount: 10 }],
    });
    const state1 = makeState({
      enemyStatuses: { ...makeState().enemyStatuses, bleed: 3 },
      gearEffects: { ...makeState().gearEffects, burnDamageBonusToBleedingPercent: 50 },
      rng: () => 0.5,
    });
    const result1 = computeCardDamageToEnemy(state1, card.effects[0] as any, card);
    expect(result1.modifiedDamage).toBe(15);

    // 2. Tick
    const state2 = makeState({
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyStatuses: { ...makeState().enemyStatuses, burn: 10, bleed: 3 },
      gearEffects: { ...makeState().gearEffects, burnDamageBonusToBleedingPercent: 50 },
    });
    const texts: any[] = [];
    const result2 = tickEnemyStatuses(state2, texts);
    expect(result2.enemyHealth).toBe(82); // 100 - 15 (burn) - 3 (bleed) = 82
  });

  it("stun-on-block-hit: deals stun when player block is depleted", () => {
    const state = makeState({
      playerStatuses: { ...makeState().playerStatuses, block: 2 },
      gearEffects: { ...makeState().gearEffects, stunOnBlockDepleted: 6 },
    });
    const effect = { kind: "damage" as const, damageType: "physical" as const, amount: 5 };
    const texts: any[] = [];
    const nextState = processEnemyDamageEffect(state, effect, texts);
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
        turnStartEffects: [{ kind: "damage", damageType: "physical", amount: 2 }],
      },
      gearEffects: { ...makeState().gearEffects, healOnCompanionAttack: 3 },
    });
    const texts: any[] = [];
    const nextState = processCompanionTurnStart(state, texts);
    expect(nextState.playerHealth).toBe(8);
  });

  it("armor-on-cc: grants armor when player is stunned or frozen", () => {
    const state = makeState({
      playerStatuses: { ...makeState().playerStatuses, armor: 0 },
      gearEffects: { ...makeState().gearEffects, armorOnStunOrFreeze: 4 },
    });
    const input = {
      state,
      stat: "stun" as const,
      stackValue: 60,
      thresholdFraction: 0.5,
      combatTexts: [],
    };
    const nextState = resolvePlayerCrowdControlTrigger(input);
    expect(nextState.playerStatuses.armor).toBe(4);
  });
});
