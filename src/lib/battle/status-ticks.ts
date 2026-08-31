import {
  applyPlayerCombatDamage,
  scaleReceivedPlayerDamage,
  setPlayerStatus,
  setFlag,
  type BattleState,
  type CombatTextEvent,
} from "./types";
import { hasEnemyTrait } from "./enemy-turn-rules";
import {
  decayArmorAfterDamage,
  decayHalvedStatus,
  decayPoisonStacks,
  getBattleRng,
  getBurnBonusToBleedingMultiplier,
  getEnemyDamageMultiplier,
  rollPercent,
} from "./status-helpers";
import { HALF_DIVISOR, POISON_GAIN_AMOUNT } from "../game-constants";
import { computeLeechHeal } from "./damage-rider-leech";
import { applyPoisonTalentRiders } from "./damage-status-riders";
import { applyHealingWithCombatText, mergeCombatText } from "./combat-text";
import { resolvePlayerCrowdControlTriggers } from "./status-cc";
import { applyEnemyLeechHealing } from "./enemy-attack-damage";
import { tryPoisonStunProc } from "./player-typed-hit";
import { payPendingBleedLeech } from "./damage-rider-leech";
import { dealEnemyDotTick } from "./dot-resolve";

function tickBurn(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.enemyStatuses.burn;
  if (damage <= 0) return state;

  const multiplier = getEnemyDamageMultiplier(state, "burn") * getBurnBonusToBleedingMultiplier(state);
  const finalDamage = Math.round(damage * multiplier);
  mergeCombatText(combatTexts, {
    target: "enemy",
    kind: "damage",
    stat: "burn",
    amount: finalDamage,
  });
  let nextBurn = state.enemyStatuses.burn;
  if (rollPercent(state.talentEffects.burnDoubleChance, getBattleRng(state))) {
    nextBurn *= HALF_DIVISOR;
  } else {
    nextBurn = decayHalvedStatus(nextBurn);
  }
  return dealEnemyDotTick(state, "burn", finalDamage, nextBurn, combatTexts);
}

function applyParasiticBloomLeech(state: BattleState, damage: number, combatTexts: CombatTextEvent[]): BattleState {
  if (!rollPercent(state.trinketEffects.parasiticBloomLeechChance, getBattleRng(state))) return state;
  return applyHealingWithCombatText(state, computeLeechHeal(damage), combatTexts, { skipFightPacing: true });
}

function tickPoison(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.enemyStatuses.poison;
  if (damage <= 0) return state;
  const multiplier = getEnemyDamageMultiplier(state, "poison");
  const finalDamage = Math.round(damage * multiplier);
  mergeCombatText(combatTexts, {
    target: "enemy",
    kind: "damage",
    stat: "poison",
    amount: finalDamage,
  });
  const isFrozenPreserved = state.enemyCC.freezeSkipTurns > 0 && state.talentEffects.freezePreventsPoisonDecay;
  let nextPoison = state.enemyStatuses.poison;
  if (!isFrozenPreserved) {
    if (rollPercent(state.talentEffects.poisonGainChance, getBattleRng(state))) {
      nextPoison += POISON_GAIN_AMOUNT;
    } else {
      nextPoison = decayPoisonStacks(nextPoison);
    }
  }
  return dealEnemyDotTick(state, "poison", finalDamage, nextPoison, combatTexts, (nextState) => {
    const afterRiders = applyPoisonTalentRiders(
      applyParasiticBloomLeech(nextState, finalDamage, combatTexts),
      finalDamage,
      combatTexts,
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

  const multiplier = getEnemyDamageMultiplier(state, "bleed");
  const finalDamage = Math.round(damage * multiplier);

  mergeCombatText(combatTexts, {
    target: "enemy",
    kind: "damage",
    stat: "bleed",
    amount: finalDamage,
  });
  const healthBeforeBleed = state.enemyHealth;
  return dealEnemyDotTick(state, "bleed", finalDamage, 0, combatTexts, (nextState) => {
    return payPendingBleedLeech(healthBeforeBleed, nextState, combatTexts);
  });
}

export function tickEnemyStatuses(state: BattleState, combatTexts: CombatTextEvent[]) {
  if (state.enemyStatuses.burn <= 0 && state.enemyStatuses.poison <= 0 && state.enemyStatuses.bleed <= 0) {
    if (state.pendingBleedLeechHealing === 0) return state;
    return { ...state, pendingBleedLeechHealing: 0 };
  }
  let nextState = tickBurn(state, combatTexts);
  nextState = tickPoison(nextState, combatTexts);
  nextState = tickBleed(nextState, combatTexts);
  return nextState;
}

function dealPlayerDotTick(
  state: BattleState,
  reducedDamage: number,
  status: "burn" | "poison" | "bleed",
  nextStacks: number,
  combatTexts: CombatTextEvent[],
  damageType?: string,
  applyRiders?: (state: BattleState) => BattleState,
): BattleState {
  let nextState = setPlayerStatus(applyPlayerCombatDamage(state, reducedDamage, damageType), status, nextStacks);
  if (applyRiders) nextState = applyRiders(nextState);
  const healthLost = state.playerHealth - nextState.playerHealth;
  if (healthLost > 0) {
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "damage",
      stat: status,
      amount: healthLost,
    });
  }
  return decayArmorAfterDamage(nextState, reducedDamage, "player", combatTexts);
}

function mitigatePlayerDot(state: BattleState, damage: number, status: "burn" | "bleed"): number {
  const scaled = scaleReceivedPlayerDamage(damage, state.talentEffects, status);
  const blockReduction = status === "burn" ? state.talentEffects.blockReduceBurnDamage : 0;
  const afterBlock =
    blockReduction > 0 && state.playerStatuses.block > 0 ? Math.max(0, scaled - blockReduction) : scaled;
  const armorMitigates =
    status === "burn" ? state.talentEffects.armorMitigatesBurn : state.talentEffects.armorMitigatesBleed;
  return armorMitigates ? Math.max(0, afterBlock - state.playerStatuses.armor) : afterBlock;
}

function tickPlayerBurn(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.playerStatuses.burn;
  if (damage <= 0) return state;
  const reducedDamage = mitigatePlayerDot(state, damage, "burn");
  return dealPlayerDotTick(
    state,
    reducedDamage,
    "burn",
    decayHalvedStatus(state.playerStatuses.burn),
    combatTexts,
    "burn",
  );
}

function tickPlayerPoison(state: BattleState, combatTexts: CombatTextEvent[]) {
  const damage = state.playerStatuses.poison;
  if (damage <= 0) return state;
  const reducedDamage = scaleReceivedPlayerDamage(damage, state.talentEffects, "poison");
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
  return dealPlayerDotTick(state, finalDamage, "bleed", 0, combatTexts, undefined, (nextState) => {
    const enemyLeechDamage = Math.min(pendingLeech, healthBeforeBleed - nextState.playerHealth);
    let next = nextState;
    if (enemyLeechDamage > 0) {
      next = applyEnemyLeechHealing(next, enemyLeechDamage, combatTexts);
    }
    next = { ...next, pendingEnemyBleedLeechHealing: 0 };
    if (hasEnemyTrait(state, "blood-cultist") && healthBeforeBleed > next.playerHealth) {
      next = setFlag(next, "enemyNextAttackCrit", true);
    }
    return next;
  });
}

export function tickPlayerStatuses(state: BattleState, combatTexts: CombatTextEvent[]) {
  if (state.playerStatuses.burn <= 0 && state.playerStatuses.poison <= 0 && state.playerStatuses.bleed <= 0) {
    let nextState = state;
    if (nextState.pendingEnemyBleedLeechHealing !== 0) {
      nextState = { ...nextState, pendingEnemyBleedLeechHealing: 0 };
    }
    return resolvePlayerCrowdControlTriggers(nextState, combatTexts);
  }
  let nextState = tickPlayerBurn(state, combatTexts);
  nextState = tickPlayerPoison(nextState, combatTexts);
  nextState = tickPlayerBleed(nextState, combatTexts);
  return resolvePlayerCrowdControlTriggers(nextState, combatTexts);
}
