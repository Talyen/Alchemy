import { resolveBattleSequence } from "./battle-sequence";
import { applyHealthLossTalentRewards, checkHealthThresholds } from "./status-player";
import { drawKeywordCard } from "./draw";
import { hasEncounterBenefit } from "./types";
import { LABYRINTH_MODIFIER_CONFIG } from "../game-constants";
import {
  applyPlayerCombatDamage,
  isPlayerDefeated,
  mitigatePlayerCombatDamage,
  scaleReceivedPlayerDamage,
  setPlayerStatus,
  type BattleState,
  type CombatTextEvent,
} from "./types";
import {
  applyPoisonDamageArmorRider,
  armorMitigatesElementalDamage,
  decayArmorAfterDamage,
  decayHalvedStatus,
  decayPoisonStacks,
  getBurnBonusToBleedingMultiplier,
  getEnemyDamageMultiplier,
  getPoisonBonusAgainstBleeding,
  getPoisonDamageMultiplierAgainstBleeding,
  rollTalentChance,
  reduceDamageByMana,
} from "./status-helpers";
import { gearFrozenDamageMultiplier } from "./gear-effects";
import { POISON_GAIN_AMOUNT } from "../game-constants";
import { applyPoisonTalentRiders } from "./damage-status-riders";
import { mergeCombatText } from "./combat-text-events";
import { resolvePlayerCrowdControlTriggers } from "./status-cc";
import { applyEnemyLeechHealing, resolvePendingBattleReactions } from "./enemy-attack-damage";
import { resolveFollowUpHit, tryPoisonStunProc } from "./follow-up-hit-resolution";
import { payPendingBleedLeech } from "./damage-rider-leech";
import { dealEnemyDotTick } from "./dot-resolve";

function emitDotCombatText(
  combatTexts: CombatTextEvent[],
  target: "enemy" | "player",
  stat: "burn" | "poison" | "bleed",
  amount: number,
) {
  mergeCombatText(combatTexts, { target, kind: "damage", stat, amount });
}

function tickBurn(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.enemyStatuses.burn;
  if (damage <= 0) return state;

  const multiplier =
    getEnemyDamageMultiplier(state, "burn") *
    getBurnBonusToBleedingMultiplier(state) *
    gearFrozenDamageMultiplier(state);
  const finalDamage = Math.round(damage * multiplier);
  emitDotCombatText(combatTexts, "enemy", "burn", finalDamage);
  let nextBurn = state.enemyStatuses.burn;
  const preventsDecay =
    state.talentEffects.burnPreventDecayChance > 0 &&
    rollTalentChance(state.talentEffects.burnPreventDecayChance, state);
  if (!preventsDecay && !hasEncounterBenefit(state, "eternal-flame")) {
    nextBurn = decayHalvedStatus(nextBurn);
  }
  return dealEnemyDotTick(state, "burn", finalDamage, nextBurn, combatTexts);
}

export function tickEnemyPoison(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.enemyStatuses.poison;
  if (damage <= 0) return state;
  const multiplier = getEnemyDamageMultiplier(state, "poison") * gearFrozenDamageMultiplier(state);
  const finalDamage = Math.round(
    (damage + getPoisonBonusAgainstBleeding(state)) * multiplier * getPoisonDamageMultiplierAgainstBleeding(state),
  );
  emitDotCombatText(combatTexts, "enemy", "poison", finalDamage);
  const isFrozenPreserved = state.enemyCC.freezeSkipTurns > 0 && state.talentEffects.freezePreventsPoisonDecay;
  let nextPoison = state.enemyStatuses.poison;
  if (rollTalentChance(state.talentEffects.poisonGainChance, state)) {
    nextPoison += POISON_GAIN_AMOUNT;
  } else if (!isFrozenPreserved) {
    nextPoison = decayPoisonStacks(
      nextPoison,
      hasEncounterBenefit(state, "venomous") ? LABYRINTH_MODIFIER_CONFIG.half : 1,
    );
  }
  return dealEnemyDotTick(state, "poison", finalDamage, nextPoison, combatTexts, (nextState, hit) => {
    let afterRiders = applyPoisonDamageArmorRider(nextState, finalDamage);
    afterRiders = applyPoisonTalentRiders(afterRiders, hit.healthDamage, combatTexts, true, (current, damage, texts) =>
      resolveFollowUpHit(current, { source: "talent-derived", damageType: "bleed", amount: damage }, texts),
    );
    return tryPoisonStunProc(afterRiders, finalDamage, combatTexts);
  });
}

function tickBleed(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.enemyStatuses.bleed;
  if (damage <= 0) {
    if (state.pendingBleedLeechHealing === 0) return state;
    return { ...state, pendingBleedLeechHealing: 0 };
  }

  const multiplier =
    getEnemyDamageMultiplier(state, "bleed") *
    gearFrozenDamageMultiplier(state) *
    (state.gearEffects.sharedBurnBleedBonuses > 0 ? getBurnBonusToBleedingMultiplier(state) : 1);
  const finalDamage = Math.round(damage * multiplier);

  emitDotCombatText(combatTexts, "enemy", "bleed", finalDamage);
  const healthBeforeBleed = state.enemyHealth;
  const nextBleed = state.gearEffects.bleedDecaysByHalf > 0 ? decayHalvedStatus(damage) : 0;
  return dealEnemyDotTick(state, "bleed", finalDamage, nextBleed, combatTexts, (nextState) => {
    const afterLeech = payPendingBleedLeech(healthBeforeBleed, nextState, combatTexts, true);
    return nextState.enemyHealth < healthBeforeBleed && state.talentEffects.drawPhysicalOnBleedTick
      ? drawKeywordCard(afterLeech, "physical")
      : afterLeech;
  });
}

export function tickEnemyStatuses(state: BattleState, combatTexts: CombatTextEvent[]) {
  if (state.enemyHealth <= 0 || isPlayerDefeated(state)) return state;
  if (state.enemyStatuses.burn <= 0 && state.enemyStatuses.poison <= 0 && state.enemyStatuses.bleed <= 0) {
    if (state.pendingBleedLeechHealing === 0) return state;
    return { ...state, pendingBleedLeechHealing: 0 };
  }
  return resolveBattleSequence(
    state,
    [tickBurn, tickEnemyPoison, tickBleed],
    combatTexts,
    (current, tick) => tick(current, combatTexts),
    { kind: "each-step", settle: resolvePendingBattleReactions },
    "either-defeated",
  );
}

function dealPlayerDotTick(
  state: BattleState,
  damage: number,
  status: "burn" | "poison" | "bleed",
  nextStacks: number,
  combatTexts: CombatTextEvent[],
  applyRiders?: (state: BattleState) => BattleState,
): BattleState {
  const reducedDamage = mitigatePlayerCombatDamage(state, damage, status);
  let nextState = setPlayerStatus(
    applyPlayerCombatDamage(state, reducedDamage, "hostile", status, { ignoreMitigation: true }, combatTexts),
    status,
    nextStacks,
  );
  if (applyRiders) nextState = applyRiders(nextState);
  const phoenixTriggered = state.playerStatuses.phoenixFeather > 0 && nextState.playerStatuses.phoenixFeather === 0;
  const healthLost = phoenixTriggered ? state.playerHealth : Math.max(0, state.playerHealth - nextState.playerHealth);
  if (healthLost > 0) {
    emitDotCombatText(combatTexts, "player", status, healthLost);
  }
  nextState = checkHealthThresholds(state.playerHealth, nextState.playerHealth, nextState, combatTexts);
  nextState = applyHealthLossTalentRewards(state, nextState, healthLost, combatTexts);
  return decayArmorAfterDamage(nextState, reducedDamage, "player", combatTexts);
}

function mitigatePlayerDot(state: BattleState, damage: number, status: "burn" | "poison" | "bleed"): number {
  const scaled = scaleReceivedPlayerDamage(reduceDamageByMana(state, damage), state.talentEffects, status);
  const blockReduction = status === "burn" ? state.talentEffects.blockReduceBurnDamage : 0;
  const afterBlock =
    blockReduction > 0 && state.playerStatuses.block > 0 ? Math.max(0, scaled - blockReduction) : scaled;
  return armorMitigatesElementalDamage(state, status)
    ? Math.max(0, afterBlock - state.playerStatuses.armor)
    : afterBlock;
}

function tickPlayerBurn(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.playerStatuses.burn;
  if (damage <= 0) return state;
  const reducedDamage = mitigatePlayerDot(state, damage, "burn");
  return dealPlayerDotTick(state, reducedDamage, "burn", decayHalvedStatus(state.playerStatuses.burn), combatTexts);
}

function tickPlayerPoison(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.playerStatuses.poison;
  if (damage <= 0) return state;
  const reducedDamage = mitigatePlayerDot(state, damage, "poison");
  return dealPlayerDotTick(state, reducedDamage, "poison", decayPoisonStacks(state.playerStatuses.poison), combatTexts);
}

function tickPlayerBleed(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.playerStatuses.bleed;
  if (damage <= 0) {
    if (state.pendingEnemyBleedLeechHealing === 0) return state;
    return { ...state, pendingEnemyBleedLeechHealing: 0 };
  }
  const finalDamage = mitigatePlayerDot(state, damage, "bleed");
  const healthBeforeBleed = state.playerHealth;
  const pendingLeech = state.pendingEnemyBleedLeechHealing;
  return dealPlayerDotTick(state, finalDamage, "bleed", 0, combatTexts, (nextState) => {
    const phoenixTriggered = state.playerStatuses.phoenixFeather > 0 && nextState.playerStatuses.phoenixFeather === 0;
    const healthLost = phoenixTriggered ? healthBeforeBleed : Math.max(0, healthBeforeBleed - nextState.playerHealth);
    const enemyLeechDamage = Math.min(pendingLeech, healthLost);
    let next = nextState;
    if (enemyLeechDamage > 0) {
      next = applyEnemyLeechHealing(next, enemyLeechDamage, combatTexts);
    }
    next = { ...next, pendingEnemyBleedLeechHealing: 0 };
    return next;
  });
}

function resolvePlayerEndOfTickReactions(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  // Battle completion stops crowd control; already-earned reactions still drain.
  if (state.enemyHealth <= 0 || isPlayerDefeated(state)) {
    return resolvePendingBattleReactions(state, combatTexts);
  }
  return resolvePendingBattleReactions(resolvePlayerCrowdControlTriggers(state, combatTexts), combatTexts);
}

export function tickPlayerStatuses(state: BattleState, combatTexts: CombatTextEvent[]) {
  if (state.playerStatuses.burn <= 0 && state.playerStatuses.poison <= 0 && state.playerStatuses.bleed <= 0) {
    let nextState = state;
    if (nextState.pendingEnemyBleedLeechHealing !== 0) {
      nextState = { ...nextState, pendingEnemyBleedLeechHealing: 0 };
    }
    return resolvePlayerEndOfTickReactions(nextState, combatTexts);
  }
  let nextState = tickPlayerBurn(state, combatTexts);
  if (nextState.enemyHealth <= 0 || isPlayerDefeated(nextState)) {
    return resolvePlayerEndOfTickReactions(nextState, combatTexts);
  }
  nextState = tickPlayerPoison(nextState, combatTexts);
  if (nextState.enemyHealth <= 0 || isPlayerDefeated(nextState)) {
    return resolvePlayerEndOfTickReactions(nextState, combatTexts);
  }
  nextState = tickPlayerBleed(nextState, combatTexts);
  return resolvePlayerEndOfTickReactions(nextState, combatTexts);
}
