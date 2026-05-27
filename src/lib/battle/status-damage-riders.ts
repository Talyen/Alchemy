/**
 * Damage-type status riders applied when card damage lands on the enemy.
 * Depends on: ./status-stun-resolve, ./talent-effects, ./status-cc, ./status-helpers, ./types, ./combat-text.
 */
import type { BattleCardEffect, DamageType } from "@/lib/game-data";
import {
  addEnemyStatus,
  addGold,
  adjustEnemyStatusDelta,
  applyPlayerHealing,
  clampHealth,
  reduceEnemyArmor,
  setEnemyStatus,
  setFlag,
  type BattleState,
  type CombatTextEvent,
} from "./types";
import { emitOverhealBlockText, mergeCombatText } from "./combat-text";
import { applyFreezeBlockTalent, applyFreezeStripArmorTalent } from "./talent-effects";
import { applyEnemyCcImmunityClear, assignEnemyCrowdControlSkip } from "./status-cc";
import { resolveStunTrigger } from "./status-stun-resolve";
import { decayArmorAfterDamage, rollPercent } from "./status-helpers";
import { BLEED_STATUS_MULTIPLIER, BATTLE_CONFIG, FREEZE_THRESHOLD_FRACTION } from "../game-constants";

function applyBurnStatusRider(state: BattleState, actualDamage: number): BattleState {
  let nextState = addEnemyStatus(state, "burn", actualDamage);
  if (nextState.talentEffects.burnRemovesEnemyArmor) {
    nextState = reduceEnemyArmor(nextState, actualDamage);
  }
  return nextState;
}

function applyPoisonStatusRider(state: BattleState, actualDamage: number, combatTexts: CombatTextEvent[]): BattleState {
  let nextState = addEnemyStatus(state, "poison", actualDamage);
  if (
    actualDamage > 0 &&
    nextState.talentEffects.goldOnFirstPoison > 0 &&
    !nextState.flags.goldOnFirstPoisonThisCombat
  ) {
    nextState = setFlag(
      addGold(nextState, nextState.talentEffects.goldOnFirstPoison),
      "goldOnFirstPoisonThisCombat",
      true,
    );
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "status",
      stat: "gold",
      amount: nextState.talentEffects.goldOnFirstPoison,
    });
  }
  nextState = applyPoisonTalentRiders(nextState, actualDamage, combatTexts);
  return nextState;
}

export function applyPoisonTalentRiders(
  state: BattleState,
  damage: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  let nextState = state;
  if (damage > 0 && rollPercent(nextState.talentEffects.poisonStunChance, nextState.rng)) {
    nextState = resolveStunTrigger(addEnemyStatus(nextState, "stun", damage), combatTexts);
  }
  if (nextState.talentEffects.poisonStripArmor) {
    nextState = reduceEnemyArmor(nextState, 1);
  }
  if (damage > 0 && rollPercent(nextState.talentEffects.poisonLeechChance, nextState.rng)) {
    const prevState = nextState;
    nextState = applyPlayerHealing(nextState, damage);
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "heal",
      stat: "health",
      amount: damage,
    });
    emitOverhealBlockText(prevState, nextState, combatTexts);
  }
  return nextState;
}

function stackBleed(state: BattleState, statusDamage: number): BattleState {
  const bleedAmount = statusDamage * BLEED_STATUS_MULTIPLIER;
  return setEnemyStatus(state, "bleed", state.enemyStatuses.bleed + bleedAmount);
}

function queueBleedLeech(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  bleedAmount: number,
): BattleState {
  if (bleedAmount <= 0) return state;
  const leechFromCard = effect.lifesteal;
  const leechFromTalent = rollPercent(state.talentEffects.bleedLeechChance, state.rng);
  if (!leechFromCard && !leechFromTalent) return state;
  return { ...state, pendingBleedLeechHealing: state.pendingBleedLeechHealing + bleedAmount };
}

function procBleedPoison(state: BattleState, actualDamage: number, bleedAmount: number): BattleState {
  if (
    bleedAmount <= 0 ||
    actualDamage <= 0 ||
    state.talentEffects.bleedPoisonChance <= 0 ||
    !rollPercent(state.talentEffects.bleedPoisonChance, state.rng)
  )
    return state;
  return addEnemyStatus(state, "poison", actualDamage);
}

function awardCutpurseGold(state: BattleState, bleedAmount: number, combatTexts: CombatTextEvent[]): BattleState {
  if (bleedAmount <= 0 || state.trinketEffects.cutpurseGoldOnBleed <= 0) return state;
  mergeCombatText(combatTexts, {
    target: "player",
    kind: "status",
    stat: "gold",
    amount: state.trinketEffects.cutpurseGoldOnBleed,
  });
  return addGold(state, state.trinketEffects.cutpurseGoldOnBleed);
}

function applyBleedStatusRider(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  actualDamage: number,
  statusDamage: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  const bleedAmount = statusDamage * BLEED_STATUS_MULTIPLIER;
  let nextState = stackBleed(state, statusDamage);
  nextState = queueBleedLeech(nextState, effect, bleedAmount);
  nextState = procBleedPoison(nextState, actualDamage, bleedAmount);
  return awardCutpurseGold(nextState, bleedAmount, combatTexts);
}

function applyStunStatusRider(state: BattleState, actualDamage: number, combatTexts: CombatTextEvent[]): BattleState {
  return resolveStunTrigger(addEnemyStatus(state, "stun", actualDamage), combatTexts);
}

function applyFrozenHeartDamage(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  if (state.trinketEffects.frozenHeartDamage <= 0) return state;
  const dmg = state.trinketEffects.frozenHeartDamage;
  mergeCombatText(combatTexts, {
    target: "enemy",
    kind: "damage",
    stat: "physical",
    amount: dmg,
  });
  return {
    ...state,
    enemyHealth: clampHealth(state.enemyHealth, -dmg, state.enemyMaxHealth),
  };
}

function tryTriggerEnemyFreeze(
  preHitState: BattleState,
  nextState: BattleState,
  combatTexts: CombatTextEvent[],
): BattleState {
  const freezeThreshold = FREEZE_THRESHOLD_FRACTION - preHitState.talentEffects.freezeThresholdReduction;
  if (preHitState.enemyHealth <= 0 || nextState.enemyStatuses.freeze < preHitState.enemyHealth * freezeThreshold) {
    return nextState;
  }

  const immuneClear = applyEnemyCcImmunityClear({
    nextState,
    stat: "freeze",
    ccCooldown: preHitState.enemyCCCooldown,
  });
  if (immuneClear) return immuneClear;

  const skipDuration = BATTLE_CONFIG.BASE_CC_DURATION + nextState.trinketEffects.freezeDurationExtension;
  let result = assignEnemyCrowdControlSkip({
    nextState,
    stat: "freeze",
    skipDuration,
    combatTexts,
  });
  result = applyFrozenHeartDamage(result, combatTexts);
  result = applyFreezeBlockTalent(result, combatTexts);
  result = applyFreezeStripArmorTalent(result);
  return result;
}

function applyFreezeStatusRider(state: BattleState, actualDamage: number, combatTexts: CombatTextEvent[]): BattleState {
  const nextState = addEnemyStatus(state, "freeze", actualDamage);
  return tryTriggerEnemyFreeze(state, nextState, combatTexts);
}

// Intentional: bleed chance + detonation talents can self-combo on one hit.
function applyPhysicalStunChance(
  state: BattleState,
  actualDamage: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  if (actualDamage <= 0 || !rollPercent(state.talentEffects.physicalStunChance, state.rng)) return state;
  return resolveStunTrigger(addEnemyStatus(state, "stun", actualDamage), combatTexts);
}

function applyPhysicalBleedChance(state: BattleState, actualDamage: number): BattleState {
  if (actualDamage <= 0 || !rollPercent(state.talentEffects.physicalBleedChance, state.rng)) return state;
  return addEnemyStatus(state, "bleed", actualDamage);
}

function applyPhysicalBleedDetonate(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  if (!state.talentEffects.physicalDetonatesBleed || state.enemyStatuses.bleed <= 0) return state;
  const bleedDamage = state.enemyStatuses.bleed;
  let nextState: BattleState = {
    ...state,
    enemyHealth: clampHealth(state.enemyHealth, -bleedDamage, state.enemyMaxHealth),
    enemyStatuses: { ...state.enemyStatuses, bleed: 0 },
  };
  mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: "bleed", amount: bleedDamage });
  nextState = decayArmorAfterDamage(nextState, bleedDamage, "enemy", combatTexts);
  return nextState;
}

function applyPhysicalStatusRider(
  state: BattleState,
  actualDamage: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  let nextState = applyPhysicalStunChance(state, actualDamage, combatTexts);
  nextState = applyPhysicalBleedChance(nextState, actualDamage);
  nextState = applyPhysicalBleedDetonate(nextState, combatTexts);
  return nextState;
}

type DamageStatusContext = {
  state: BattleState;
  effect: Extract<BattleCardEffect, { kind: "damage" }>;
  actualDamage: number;
  combatTexts: CombatTextEvent[];
};

type DamageStatusHandler = (ctx: DamageStatusContext) => BattleState;

const DAMAGE_STATUS_HANDLERS: Partial<Record<DamageType, DamageStatusHandler>> = {
  burn: ({ state, actualDamage }) => applyBurnStatusRider(state, actualDamage),
  poison: ({ state, actualDamage, combatTexts }) => applyPoisonStatusRider(state, actualDamage, combatTexts),
  bleed: ({ state, effect, actualDamage, combatTexts }) => {
    const statusDamage = adjustEnemyStatusDelta(state, actualDamage);
    return applyBleedStatusRider(state, effect, actualDamage, statusDamage, combatTexts);
  },
  stun: ({ state, actualDamage, combatTexts }) => applyStunStatusRider(state, actualDamage, combatTexts),
  freeze: ({ state, actualDamage, combatTexts }) => applyFreezeStatusRider(state, actualDamage, combatTexts),
  physical: ({ state, actualDamage, combatTexts }) => applyPhysicalStatusRider(state, actualDamage, combatTexts),
  holy: ({ state }) => state,
  nature: ({ state }) => state,
};

export function applyDamageStatuses(
  state: BattleState,
  effect: Extract<BattleCardEffect, { kind: "damage" }>,
  actualDamage: number,
  combatTexts: CombatTextEvent[],
) {
  const handler = DAMAGE_STATUS_HANDLERS[effect.damageType];
  if (!handler) return state;
  return handler({ state, effect, actualDamage, combatTexts });
}
