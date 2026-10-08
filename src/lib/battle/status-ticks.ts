import { rollBattleChance } from "./chance-roll";
import { resolveBattleSequence } from "./battle-sequence";
import { applyHealthLossTalentRewards, checkHealthThresholds } from "./status-player";
import { drawKeywordCard } from "./draw";
import { hasEncounterBenefit } from "./encounter-trait-state";
import { LABYRINTH_MODIFIER_CONFIG } from "../game-constants";
import type { BattleState, CombatTextEvent } from "./types";
import {
  applyPlayerCombatDamage,
  isPlayerDefeated,
  mitigatePlayerCombatDamage,
  playerHealthLostToDamage,
} from "./health-state";
import { scaleReceivedPlayerDamage } from "./damage-modifiers";
import { setPlayerStatus } from "./status-state";
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
  reduceDamageByMana,
} from "./status-helpers";
import { gearFrozenDamageMultiplier } from "./scaled-damage";
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
  mergeCombatText(combatTexts, { target, kind: "damage", stat, amount, periodic: true });
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
    rollBattleChance(state.talentEffects.burnPreventDecayChance, state);
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
  if (rollBattleChance(state.talentEffects.poisonGainChance, state)) {
    nextPoison += POISON_GAIN_AMOUNT;
  } else if (!isFrozenPreserved) {
    nextPoison = decayPoisonStacks(
      nextPoison,
      hasEncounterBenefit(state, "venomous") ? LABYRINTH_MODIFIER_CONFIG.half : 1,
    );
  }
  return dealEnemyDotTick(state, "poison", finalDamage, nextPoison, combatTexts, (nextState, hit) => {
    let afterRiders = applyPoisonDamageArmorRider(nextState, finalDamage, combatTexts);
    afterRiders = applyPoisonTalentRiders(afterRiders, hit.healthDamage, combatTexts, true, (current, damage, texts) =>
      resolveFollowUpHit(current, { source: "talent-derived", damageType: "bleed", amount: damage }, texts),
    );
    return tryPoisonStunProc(afterRiders, finalDamage, combatTexts);
  });
}

function tickBleed(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.enemyStatuses.bleed;
  if (damage <= 0) {
    if (state.pendingBleedLeechHealing === 0 && state.pendingCardBleedLeechHealing === 0) return state;
    return { ...state, pendingBleedLeechHealing: 0, pendingCardBleedLeechHealing: 0 };
  }

  const multiplier =
    getEnemyDamageMultiplier(state, "bleed") *
    gearFrozenDamageMultiplier(state) *
    (state.gearEffects.sharedBurnBleedBonuses > 0 ? getBurnBonusToBleedingMultiplier(state) : 1);
  const finalDamage = Math.round(damage * multiplier);

  emitDotCombatText(combatTexts, "enemy", "bleed", finalDamage);
  const healthBeforeBleed = state.enemyHealth;
  const nextBleed = state.gearEffects.bleedDecaysByHalf > 0 ? decayHalvedStatus(damage) : 0;
  return dealEnemyDotTick(state, "bleed", finalDamage, nextBleed, combatTexts, (nextState, hit) => {
    const afterLeech = payPendingBleedLeech(healthBeforeBleed, nextState, combatTexts, true, hit.healthDamage);
    const retainedLeech = {
      ...afterLeech,
      pendingBleedLeechHealing: Math.min(nextBleed, decayHalvedStatus(state.pendingBleedLeechHealing)),
      pendingCardBleedLeechHealing: Math.min(nextBleed, decayHalvedStatus(state.pendingCardBleedLeechHealing)),
    };
    return hit.healthDamage > 0 && state.talentEffects.drawPhysicalOnBleedTick
      ? drawKeywordCard(retainedLeech, "physical")
      : retainedLeech;
  });
}

export function tickEnemyStatuses(state: BattleState, combatTexts: CombatTextEvent[]) {
  if (state.enemyHealth <= 0 || isPlayerDefeated(state)) return state;
  if (state.enemyStatuses.burn <= 0 && state.enemyStatuses.poison <= 0 && state.enemyStatuses.bleed <= 0) {
    if (state.pendingBleedLeechHealing === 0 && state.pendingCardBleedLeechHealing === 0) return state;
    return { ...state, pendingBleedLeechHealing: 0, pendingCardBleedLeechHealing: 0 };
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
  const healthLost = playerHealthLostToDamage(state, nextState);
  if (healthLost > 0) {
    emitDotCombatText(combatTexts, "player", status, healthLost);
  }
  const healthAfterTick = nextState.playerHealth;
  nextState = decayArmorAfterDamage(nextState, reducedDamage, "player", combatTexts);
  nextState = checkHealthThresholds(state.playerHealth, healthAfterTick, nextState, combatTexts);
  nextState = applyHealthLossTalentRewards(state, nextState, healthLost, combatTexts);
  return nextState;
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

function tickPlayerBleed(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.playerStatuses.bleed;
  if (damage <= 0) {
    if (state.pendingEnemyBleedLeechHealing === 0) return state;
    return { ...state, pendingEnemyBleedLeechHealing: 0 };
  }
  const finalDamage = mitigatePlayerDot(state, damage, "bleed");
  const pendingLeech = state.pendingEnemyBleedLeechHealing;
  return dealPlayerDotTick(state, finalDamage, "bleed", 0, combatTexts, (nextState) => {
    const healthLost = playerHealthLostToDamage(state, nextState);
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
  let nextState = state;
  // Burn and Poison settle their reactions before the next tick. Bleed is
  // followed by the shared end-of-tick settlement, including crowd control.
  for (const status of ["burn", "poison"] as const) {
    const stacks = nextState.playerStatuses[status];
    if (stacks > 0) {
      nextState = dealPlayerDotTick(
        nextState,
        mitigatePlayerDot(nextState, stacks, status),
        status,
        status === "burn" ? decayHalvedStatus(stacks) : decayPoisonStacks(stacks),
        combatTexts,
      );
    }
    nextState = resolvePendingBattleReactions(nextState, combatTexts);
    if (nextState.enemyHealth <= 0 || isPlayerDefeated(nextState)) {
      return resolvePlayerEndOfTickReactions(nextState, combatTexts);
    }
  }
  return resolvePlayerEndOfTickReactions(tickPlayerBleed(nextState, combatTexts), combatTexts);
}
