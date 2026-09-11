import type { BattleCard, DamageType, TalentEffectManifest } from "@/lib/game-data";
import { getBattleRng, rollPercent } from "@/lib/rng";
import { applyNatureManaRefund } from "./bonus-effects";
import { computeCardDamageToEnemy, computeTalentDamageToEnemy } from "./damage-calc";
import {
  applyDamageBlock,
  applyHolyLifesteal,
  applyHolyTithe,
  applyLeechHitHealing,
  applyLeechHitRewards,
} from "./damage-rider-leech";
import { rollTalentChance } from "./status-helpers";
import { addForgeToPlayer } from "./status-player";
import { resolveTypedEnemyHit } from "./typed-hit-resolution";
import { setFlag, type BattleState, type CombatTextEvent } from "./types";

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
  const hit = resolveTypedEnemyHit(afterMods, effect, modifiedDamage, combatTexts);
  const preHitHealth = hit.previousHealth;
  let nextState = hit.state;
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
  const hit = resolveTypedEnemyHit(blocked, { kind: "damage", damageType, amount }, resolved, combatTexts);
  let nextState = hit.state;
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
  nextState = applyTalentHitConversions(nextState, "leech", damage, combatTexts);
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

type ConversionSource = "physical" | "bleed" | "nature" | "holy" | "leech";
type NumericTalentEffect = {
  [K in keyof TalentEffectManifest]: TalentEffectManifest[K] extends number ? K : never;
}[keyof TalentEffectManifest];
interface HitConversion {
  chance: NumericTalentEffect;
  target: "burn" | "poison" | "bleed";
}

const TALENT_HIT_CONVERSIONS: Record<ConversionSource, readonly HitConversion[]> = {
  physical: [{ chance: "physicalBleedDamageChance", target: "bleed" }],
  bleed: [{ chance: "bleedPoisonDamageChance", target: "poison" }],
  nature: [{ chance: "naturePoisonDamageChance", target: "poison" }],
  holy: [{ chance: "holyBurnDamageChance", target: "burn" }],
  leech: [
    { chance: "leechBleedDamageChance", target: "bleed" },
    { chance: "leechPoisonDamageChance", target: "poison" },
  ],
};

export function applyTalentHitConversions(
  state: BattleState,
  source: ConversionSource,
  damage: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  let next = state;
  // Array order is combat order: it also determines the persisted RNG stream's next draw.
  for (const reaction of TALENT_HIT_CONVERSIONS[source]) {
    next = tryTalentTypedHit(next, state.talentEffects[reaction.chance], reaction.target, damage, combatTexts);
  }
  return next;
}
