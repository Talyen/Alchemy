import { applyHealthThresholdCleanse } from "./status-player";
import { scaledGearLeechHeal } from "./gear-effects";
import { drawKeywordCard } from "./draw";
import { hasEncounterBenefit } from "./types";
import { LABYRINTH_MODIFIER_CONFIG } from "../game-constants";
import {
  applyPlayerCombatDamage,
  mitigatePlayerCombatDamage,
  scaleReceivedPlayerDamage,
  setPlayerStatus,
  type BattleState,
  type CombatTextEvent,
} from "./types";
import {
  decayArmorAfterDamage,
  decayHalvedStatus,
  decayPoisonStacks,
  getBurnBonusToBleedingMultiplier,
  getEnemyDamageMultiplier,
} from "./status-helpers";
import { getBattleRng, rollPercent } from "@/lib/rng";
import { POISON_GAIN_AMOUNT } from "../game-constants";
import { applyLeechHealing, computeLeechHeal, scalePlayerLeechHeal } from "./damage-rider-leech";
import { applyPoisonTalentRiders } from "./damage-status-riders";
import { mergeCombatText } from "./combat-text";
import { resolvePlayerCrowdControlTriggers } from "./status-cc";
import { applyEnemyLeechHealing, resolvePendingCinderSkinReaction } from "./enemy-attack-damage";
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
  const preventsDecay =
    state.talentEffects.burnPreventDecayChance > 0 &&
    rollPercent(state.talentEffects.burnPreventDecayChance, getBattleRng(state));
  if (!preventsDecay && !hasEncounterBenefit(state, "eternal-flame")) {
    nextBurn = decayHalvedStatus(nextBurn);
  }
  return dealEnemyDotTick(state, "burn", finalDamage, nextBurn, combatTexts);
}

function applyParasiticBloomLeech(state: BattleState, damage: number, combatTexts: CombatTextEvent[]): BattleState {
  if (damage <= 0) return state;
  if (!rollPercent(state.trinketEffects.parasiticBloomLeechChance, getBattleRng(state))) return state;
  return applyLeechHealing(
    state,
    scalePlayerLeechHeal(state, scaledGearLeechHeal(computeLeechHeal(damage), state.gearEffects)),
    combatTexts,
    {
      afflicted: true,
    },
  );
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
      nextPoison = decayPoisonStacks(
        nextPoison,
        hasEncounterBenefit(state, "venomous") ? LABYRINTH_MODIFIER_CONFIG.half : 1,
      );
    }
  }
  return dealEnemyDotTick(state, "poison", finalDamage, nextPoison, combatTexts, (nextState) => {
    const afterRiders = applyPoisonTalentRiders(
      applyParasiticBloomLeech(nextState, Math.max(0, state.enemyHealth - nextState.enemyHealth), combatTexts),
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

  const multiplier =
    getEnemyDamageMultiplier(state, "bleed") *
    (state.gearEffects.sharedBurnBleedBonuses > 0 ? getBurnBonusToBleedingMultiplier(state) : 1);
  const finalDamage = Math.round(damage * multiplier);

  mergeCombatText(combatTexts, {
    target: "enemy",
    kind: "damage",
    stat: "bleed",
    amount: finalDamage,
  });
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
  if (state.enemyHealth <= 0) return state;
  if (state.enemyStatuses.burn <= 0 && state.enemyStatuses.poison <= 0 && state.enemyStatuses.bleed <= 0) {
    if (state.pendingBleedLeechHealing === 0) return state;
    return { ...state, pendingBleedLeechHealing: 0 };
  }
  let nextState = resolvePendingCinderSkinReaction(tickBurn(state, combatTexts), combatTexts);
  if (nextState.enemyHealth <= 0) return nextState;
  nextState = resolvePendingCinderSkinReaction(tickPoison(nextState, combatTexts), combatTexts);
  if (nextState.enemyHealth <= 0) return nextState;
  nextState = resolvePendingCinderSkinReaction(tickBleed(nextState, combatTexts), combatTexts);
  return nextState;
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
  const healthLost = state.playerHealth - nextState.playerHealth;
  if (healthLost > 0) {
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "damage",
      stat: status,
      amount: healthLost,
    });
  }
  nextState = applyHealthThresholdCleanse(state.playerHealth, nextState, combatTexts);
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
  return dealPlayerDotTick(state, reducedDamage, "burn", decayHalvedStatus(state.playerStatuses.burn), combatTexts);
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
  return dealPlayerDotTick(state, finalDamage, "bleed", 0, combatTexts, (nextState) => {
    const enemyLeechDamage = Math.min(pendingLeech, healthBeforeBleed - nextState.playerHealth);
    let next = nextState;
    if (enemyLeechDamage > 0) {
      next = applyEnemyLeechHealing(next, enemyLeechDamage, combatTexts);
    }
    next = { ...next, pendingEnemyBleedLeechHealing: 0 };
    return next;
  });
}

export function tickPlayerStatuses(state: BattleState, combatTexts: CombatTextEvent[]) {
  if (state.playerStatuses.burn <= 0 && state.playerStatuses.poison <= 0 && state.playerStatuses.bleed <= 0) {
    let nextState = state;
    if (nextState.pendingEnemyBleedLeechHealing !== 0) {
      nextState = { ...nextState, pendingEnemyBleedLeechHealing: 0 };
    }
    return resolvePendingCinderSkinReaction(resolvePlayerCrowdControlTriggers(nextState, combatTexts), combatTexts);
  }
  let nextState = tickPlayerBurn(state, combatTexts);
  nextState = tickPlayerPoison(nextState, combatTexts);
  nextState = tickPlayerBleed(nextState, combatTexts);
  return resolvePendingCinderSkinReaction(resolvePlayerCrowdControlTriggers(nextState, combatTexts), combatTexts);
}
