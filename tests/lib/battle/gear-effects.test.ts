import { expect, it } from "vitest";
import { applyGearKillRewards } from "@/lib/battle/player-rewards";
import type { CombatTextEvent } from "@/lib/battle/types";
import {
  makeStateWithFailedRolls as makeState,
  dealDamage,
  makeTestCard,
  makeEffect,
  patchBattleState,
} from "../../fixtures/battle";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { handlePostPlayCardDestination } from "@/lib/battle/card-consume";
import { computeCardDamageToEnemy } from "@/lib/battle/damage-calc";
import { processEnemyDamageEffect } from "@/lib/battle/enemy-attack-damage";
import { resolvePlayerHit } from "@/lib/battle/hit-resolution";
import { applyDamageStatuses, applyPoisonTalentRiders, tryTriggerEnemyFreeze } from "@/lib/battle/damage-status-riders";
import { resolveStunTrigger } from "@/lib/battle/status-stun-resolve";
import { addEnemyStatus } from "@/lib/battle/status-state";
import { tickEnemyStatuses } from "@/lib/battle/status-ticks";
import { reduceDamageByMana } from "@/lib/battle/status-helpers";
import { processCompanionTurnStart } from "@/lib/battle/companion";
import { resolvePlayerCrowdControlTrigger } from "@/lib/battle/status-cc";
import { cardById } from "@/lib/game-data";
import { MAX_HAND_SIZE } from "@/lib/game-constants";

it("kill rewards scale Gold, restore Health and include the Burn-specific reward", () => {
  const state = makeState({
    enemyHealth: 0,
    gold: 5,
    playerHealth: 10,
    enemyStatuses: { burn: 3 },
    gearEffects: { healOnKill: 3, healOnBurnEnemyDefeated: 4, goldOnKill: 4, goldGainPercent: 50 },
  });
  const texts: CombatTextEvent[] = [];
  const result = applyGearKillRewards(state, true, texts);
  expect(result.playerHealth).toBe(17);
  const unburned = { ...state, enemyStatuses: { ...state.enemyStatuses, burn: 0 } };
  expect(applyGearKillRewards(unburned, true, []).playerHealth).toBe(13);
  expect(result.gold).toBe(11);
  expect(texts).toContainEqual(expect.objectContaining({ kind: "heal" }));
  expect(texts).toContainEqual(expect.objectContaining({ stat: "gold", amount: 6 }));
});

it("Consuming augments the original Burn hit but utility consumption cannot hit or spend a Crit", () => {
  const attack = makeTestCard({ consume: true, effects: [makeEffect("burn", 1)] });
  const state = makeState({ hand: [attack], gearEffects: { burnOnConsume: 5 } });
  const result = playBattleCardResolved(state, attack.id, 0).state;
  expect(result.enemyStatuses.burn).toBe(6);
  expect(result.enemyHealth).toBe(state.enemyHealth - 6);
  const utility = makeTestCard({ consume: true, effects: [] });
  const ready = makeState({
    enemyHealth: 3,
    gold: 0,
    gearEffects: { burnOnConsume: 3, goldOnKill: 4 },
    flags: { nextHitCrit: true },
  });
  const consumed = handlePostPlayCardDestination(ready, utility);
  expect(consumed.enemyHealth).toBe(3);
  expect(consumed.gold).toBe(0);
  expect(consumed.enemyStatuses.burn).toBe(0);
  expect(consumed.flags.nextHitCrit).toBe(true);
});

it("Archery piercing reduces mitigation without removing enemy Armor", () => {
  const effect = makeEffect("physical", 10);
  const card = makeTestCard({ tags: ["archery"], effects: [effect] });
  const state = makeState({ enemyMitigation: { armor: 5 }, gearEffects: { archeryArmorPiercing: 3 } });
  const result = computeCardDamageToEnemy(state, effect, card);
  expect(result.modifiedDamage).toBe(8);
  expect(result.nextState.enemyMitigation.armor).toBe(5);
});

it("Aetherward reduces damage before Block and counts filled crystals once, excluding overflow", () => {
  const state = makeState({ mana: 3, playerStatuses: { block: 10 }, gearEffects: { damageReductionPerMana: 1 } });
  const result = processEnemyDamageEffect(state, makeEffect("physical", 10), []);
  expect(result.playerStatuses.block).toBe(3);
  expect(result.playerHealth).toBe(state.playerHealth);
  const overflow = makeState({ mana: 6, maxMana: 4, gearEffects: { damageReductionPerMana: 2 } });
  expect(reduceDamageByMana(overflow, 10)).toBe(6);
  expect(reduceDamageByMana({ ...overflow, mana: 2 }, 10)).toBe(8);
  expect(reduceDamageByMana({ ...overflow, mana: 0 }, 10)).toBe(10);
});

it("Leech rewards Mana", () => {
  const effect = makeEffect("physical", 10, { lifesteal: true });
  const state = makeState({ mana: 1, maxMana: 3, gearEffects: { manaOnLeechChance: 100 } });
  expect(
    resolvePlayerHit(
      state,
      { source: "card-attack", card: makeTestCard({ effects: [effect] }), effect, resolvedDamage: 10 },
      [],
    ).mana,
  ).toBe(2);
});

it("Nature hits refund Mana after paying the card cost", () => {
  const card = makeTestCard({ cost: 1, effects: [makeEffect("nature", 10)] });
  const nature = makeState({ mana: 3, maxMana: 3, hand: [card], gearEffects: { manaOnNatureDamageChance: 100 } });
  expect(playBattleCardResolved(nature, card.id, 0).state.mana).toBe(3);
});

it("Poison applications shred Armor exactly once; talent riders do not shred again", () => {
  const state = makeState({ enemyMitigation: { armor: 5 }, gearEffects: { poisonArmorShredChance: 100 } });
  const hit = applyDamageStatuses(state, makeEffect("poison", 4), 4, []);
  const applied = addEnemyStatus(state, "poison", 4);
  for (const result of [hit, applied]) {
    expect(result.enemyStatuses.poison).toBe(4);
    expect(result.enemyMitigation.armor).toBe(4);
  }
  expect(applyPoisonTalentRiders(state, 5, []).enemyMitigation.armor).toBe(5);
  expect(state.enemyMitigation.armor).toBe(5);
});

it("Burn bonuses against Bleeding enemies apply to card damage and ticks", () => {
  const effect = makeEffect("burn", 10);
  const state = makeState({
    enemyHealth: 100,
    enemyMaxHealth: 100,
    enemyStatuses: { burn: 10, bleed: 3 },
    gearEffects: { burnDamageBonusToBleedingPercent: 50 },
  });
  expect(computeCardDamageToEnemy(state, effect, makeTestCard({ effects: [effect] })).modifiedDamage).toBe(15);
  const texts: CombatTextEvent[] = [];
  expect(tickEnemyStatuses(state, texts).enemyHealth).toBe(77);
  expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "burn", amount: 15, periodic: true });
});

it("depleting Block retaliates with Stun damage and buildup", () => {
  const state = makeState({ playerStatuses: { block: 2 }, gearEffects: { stunOnBlockDepleted: 6 } });
  const result = processEnemyDamageEffect(state, makeEffect("physical", 5), []);
  expect(result.playerStatuses.block).toBe(0);
  expect(result.enemyHealth).toBe(state.enemyHealth - 6);
  expect(result.enemyStatuses.stun).toBe(6);
});

it("Companion attacks heal a wounded hero", () => {
  const state = makeState({
    playerHealth: 4,
    playerMaxHealth: 10,
    activeCompanion: { id: "wolf", title: "Wolf", art: "wolf", turnStartEffects: [makeEffect("physical", 2)] },
    gearEffects: { healOnCompanionAttack: 3 },
  });
  expect(processCompanionTurnStart(state, []).playerHealth).toBe(7);
});

it("being Stunned grants the hero the configured Armor", () => {
  const state = makeState({ gearEffects: { armorOnStunOrFreeze: 4 } });
  expect(
    resolvePlayerCrowdControlTrigger({ state, stat: "stun", stackValue: 60, thresholdFraction: 0.5, combatTexts: [] })
      .playerStatuses.armor,
  ).toBe(4);
});

it.each(["burn", "bleed"] as const)("Pyric grants its percentage per Mana Crystal to %s", (damageType) => {
  const state = makeState({
    enemyHealth: 100,
    enemyMaxHealth: 100,
    maxMana: 3,
    gearEffects: { burnDamagePerManaPercent: 20, sharedBurnBleedBonuses: damageType === "bleed" ? 1 : 0 },
  });
  expect(dealDamage(state, makeTestCard({ effects: [makeEffect(damageType, 10)] })).enemyHealth).toBe(84);
});

it.each([0, 1])("Bloodember shares First Blood with Burn (existing Bleed: %s)", (bleed) => {
  const state = makeState({
    enemyHealth: 100,
    enemyMaxHealth: 100,
    enemyStatuses: { bleed },
    gearEffects: { sharedBurnBleedBonuses: 1 },
    talentEffects: { bleedUnwoundedBonusPercent: 50 },
  });
  expect(dealDamage(state, makeTestCard({ effects: [makeEffect("burn", 10)] })).enemyHealth).toBe(
    bleed === 0 ? 85 : 90,
  );
});

it.each(["stun", "freeze"] as const)("Iron Guard rewards Physical damage from %s gear", (status) => {
  const state = patchBattleState({
    rng: () => 0,
    enemyHealth: 100,
    enemyMaxHealth: 100,
    enemyStatuses: { [status]: 100 },
    talentEffects: { armorOnPhysicalDamageChance: 100 },
    gearEffects: {
      damageOnStunPhysical: status === "stun" ? 6 : 0,
      damageOnFreezePhysical: status === "freeze" ? 6 : 0,
    },
  });
  const next = status === "stun" ? resolveStunTrigger(state, []) : tryTriggerEnemyFreeze(state, state, []);
  expect(next.enemyHealth).toBe(94);
  expect(next.playerStatuses.armor).toBe(6);
});

it("Icy Heart damage decays enemy Armor", () => {
  const state = patchBattleState({
    enemyHealth: 100,
    enemyMaxHealth: 100,
    enemyMitigation: { armor: 3 },
    trinketEffects: { frozenHeartDamage: 6 },
  });
  const next = tryTriggerEnemyFreeze(state, { ...state, enemyStatuses: { ...state.enemyStatuses, freeze: 100 } }, []);
  expect(next.enemyHealth).toBe(97);
  expect(next.enemyMitigation.armor).toBe(2);
});

it.each([0, MAX_HAND_SIZE])("Runic Quill reports its draw with %i cards already in hand", (handSize) => {
  const card = { ...cardById["health-potion"]! };
  const state = patchBattleState({
    hand: Array.from({ length: handSize }, () => makeTestCard()),
    deck: [makeTestCard()],
    trinketEffects: { runicQuillDrawOnConsume: 1 },
  });
  const texts: CombatTextEvent[] = [];
  const next = handlePostPlayCardDestination(state, card, { combatTexts: texts });
  expect(next.hand.length + next.pendingHandCards.length).toBe(handSize + 1);
  expect(texts).toContainEqual({ target: "player", kind: "status", stat: "draw", amount: 1 });
});

it("does not grant armorOnConsume when playing a summon-companion card", () => {
  const summonCard = makeTestCard({
    effects: [{ kind: "summon-companion", companionId: "wolf" }],
  });
  const state = patchBattleState({
    playerStatuses: { armor: 0 },
    gearEffects: { armorOnConsume: 3 },
  });
  const next = handlePostPlayCardDestination(state, summonCard, {
    triggerConsumeRiders: true,
    combatTexts: [],
  });
  expect(next.playerStatuses.armor).toBe(0);
});

it("grants armorOnConsume when playing an ordinary consume card", () => {
  const regularCard = makeTestCard({
    consume: true,
    effects: [{ kind: "damage", damageType: "physical", amount: 5 }],
  });
  const state = patchBattleState({
    playerStatuses: { armor: 0 },
    gearEffects: { armorOnConsume: 3 },
  });
  const next = handlePostPlayCardDestination(state, regularCard, {
    triggerConsumeRiders: true,
    combatTexts: [],
  });
  expect(next.playerStatuses.armor).toBe(3);
});
