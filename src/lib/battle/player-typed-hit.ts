import { applyNatureManaRefund } from "./bonus-effects";
import type { BattleCard, DamageType } from "@/lib/game-data";
import { getBattleRng, rollPercent } from "@/lib/rng";
import {
  applyHolyLifesteal,
  applyDamageBlock,
  applyHolyTithe,
  applyLeechHitHealing,
  applyLeechHitRewards,
} from "./damage-rider-leech";
import { computeCardDamageToEnemy, computeTalentDamageToEnemy } from "./damage-calc";
import { applyDamageStatuses } from "./damage-status-riders";
import { mergeCombatText, payKillPayouts } from "./combat-text";
import { decayArmorAfterDamage, rollTalentChance } from "./status-helpers";
import { addForgeToPlayer } from "./status-player";
import { setFlag, damageEnemyHealth, type BattleState, type CombatTextEvent } from "./types";
import { processEncounterTraitHealthThreshold } from "./encounter-trait-health-threshold";

const FOLLOW_UP_CARD: BattleCard = {
  id: "follow-up-typed-hit",
  title: "",
  descriptionLines: [],
  art: "",
  cost: 0,
  effects: [],
};

export function dealPlayerTypedHit(
  state: BattleState,
  damageType: DamageType,
  amount: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  if (amount <= 0 || state.enemyHealth <= 0) return state;
  const effect = { kind: "damage" as const, damageType, amount };
  const { nextState: afterMods, modifiedDamage } = computeCardDamageToEnemy(state, effect, FOLLOW_UP_CARD);
  const hit = damageEnemyHealth(afterMods, modifiedDamage);
  const enemyWasAlive = hit.enemyWasAlive;
  const preHitHealth = hit.previousHealth;
  let nextState: BattleState = hit.state;
  nextState = decayArmorAfterDamage(nextState, modifiedDamage, "enemy", combatTexts);
  nextState = applyDamageStatuses(nextState, effect, modifiedDamage, combatTexts, preHitHealth);
  if (modifiedDamage > 0) {
    mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: damageType, amount: modifiedDamage });
  }
  nextState = processEncounterTraitHealthThreshold(preHitHealth, nextState, combatTexts);
  nextState = payKillPayouts(nextState, enemyWasAlive, combatTexts);
  if (damageType === "nature") nextState = applyNatureManaRefund(nextState, modifiedDamage, combatTexts);
  return damageType === "holy" ? applyBrassCenser(nextState, modifiedDamage, combatTexts, preHitHealth) : nextState;
}

export function tryPoisonStunProc(state: BattleState, damage: number, combatTexts: CombatTextEvent[]): BattleState {
  if (damage <= 0) return state;
  if (!rollTalentChance(state.talentEffects.poisonStunChance, state)) return state;
  return dealTalentTypedHit(state, "stun", damage, combatTexts, true);
}

export function applyBrassCenser(
  state: BattleState,
  damage: number,
  combatTexts: CombatTextEvent[],
  enemyHealthBeforeHit = state.enemyHealth,
): BattleState {
  if (damage <= 0 || !rollPercent(state.trinketEffects.brassCenserProcChance, getBattleRng(state))) return state;
  if (rollPercent(50, getBattleRng(state))) {
    return dealPlayerTypedHit(state, "burn", damage, combatTexts);
  }
  return applyLifestealAndPlayerHitTriggers(state, damage, combatTexts, false, false, enemyHealthBeforeHit);
}

export function dealTalentTypedHit(
  state: BattleState,
  damageType: DamageType,
  amount: number,
  combatTexts: CombatTextEvent[],
  derived = false,
): BattleState {
  if (amount <= 0 || state.enemyHealth <= 0) return state;
  const { state: blocked, remainingDamage: resolved } = computeTalentDamageToEnemy(state, damageType, amount, derived);
  if (resolved <= 0) return blocked;
  const hit = damageEnemyHealth(blocked, resolved);
  let nextState = decayArmorAfterDamage(hit.state, resolved, "enemy", combatTexts);
  nextState = applyDamageStatuses(
    nextState,
    { kind: "damage", damageType, amount },
    resolved,
    combatTexts,
    hit.previousHealth,
  );
  mergeCombatText(combatTexts, { target: "enemy", kind: "damage", stat: damageType, amount: resolved });
  nextState = processEncounterTraitHealthThreshold(hit.previousHealth, nextState, combatTexts);
  nextState = payKillPayouts(nextState, hit.enemyWasAlive, combatTexts);
  if (damageType === "holy") {
    nextState = applyHolyLifesteal(nextState, resolved, combatTexts);
    nextState = applyDamageBlock(nextState, resolved, combatTexts);
    nextState = applyHolyTithe(nextState, resolved, combatTexts);
  }
  if (damageType === "nature") nextState = applyNatureManaRefund(nextState, resolved, combatTexts);
  if (damageType === "burn" && nextState.talentEffects.forgeOnBurnDealt > 0) {
    nextState = addForgeToPlayer(nextState, nextState.talentEffects.forgeOnBurnDealt, combatTexts);
  }
  if (damageType === "burn" && nextState.gearEffects.forgeOnBurnDealt > 0 && !nextState.flags.emberforgedUsedThisTurn) {
    nextState = setFlag(nextState, "emberforgedUsedThisTurn", true);
    nextState = addForgeToPlayer(nextState, nextState.gearEffects.forgeOnBurnDealt, combatTexts);
  }
  return nextState;
}

export function tryTalentTypedHit(
  state: BattleState,
  chance: number,
  damageType: "burn" | "poison" | "bleed",
  sourceDamage: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  if (sourceDamage <= 0 || state.enemyHealth <= 0 || !rollTalentChance(chance, state)) return state;
  return dealTalentTypedHit(state, damageType, sourceDamage * (damageType === "bleed" ? 0.25 : 0.5), combatTexts, true);
}

export function applyLifestealAndPlayerHitTriggers(
  state: BattleState,
  damage: number,
  combatTexts: CombatTextEvent[],
  cardHealing = false,
  cardLeech = cardHealing,
  enemyHealthBeforeHit = state.enemyHealth,
): BattleState {
  if (damage <= 0) return state;
  let nextState = applyLeechHitHealing(state, damage, combatTexts, cardHealing, cardLeech);
  nextState = tryTalentTypedHit(nextState, state.talentEffects.leechBleedDamageChance, "bleed", damage, combatTexts);
  nextState = tryTalentTypedHit(nextState, state.talentEffects.leechPoisonDamageChance, "poison", damage, combatTexts);
  if (enemyHealthBeforeHit < state.enemyMaxHealth / 2) {
    nextState = dealTalentTypedHit(nextState, "holy", state.talentEffects.leechHolyDamageVsLowHealth, combatTexts);
  }
  return applyLeechHitRewards(nextState, damage, combatTexts);
}

export function applyNatureLeech(
  state: BattleState,
  damage: number,
  combatTexts: CombatTextEvent[],
  enemyHealthBeforeHit = state.enemyHealth,
) {
  if (damage <= 0) return state;
  const leechChance = state.talentEffects.natureLeechChance + state.gearEffects.natureLeechChance;
  if (leechChance <= 0 || !rollTalentChance(leechChance, state)) return state;
  return applyLifestealAndPlayerHitTriggers(state, damage, combatTexts, false, false, enemyHealthBeforeHit);
}
