import type { BattleCard, DamageType, TalentEffectManifest } from "@/lib/game-data";
import { getBattleRng, rollPercent } from "@/lib/rng";
import {
  BRASS_CENSER_SPLIT_CHANCE_PERCENT,
  HALF_DIVISOR,
  TALENT_CONVERSION_BLEED_FRACTION,
  TALENT_CONVERSION_DEFAULT_FRACTION,
} from "../game-constants";
import { applyBurnForgePayout, applyLuckyCloverGold, applyNatureManaRefund } from "./bonus-effects";
import { computeCardDamageToEnemy, computeTalentDamageToEnemy, emptyBattleCard } from "./damage-calc";
import {
  applyDamageBlock,
  applyHolyLifesteal,
  applyHolyTithe,
  applyLeechHitHealing,
  applyLeechHitRewards,
} from "./damage-rider-leech";
import { rollTalentChance } from "./status-helpers";
import { resolveTypedEnemyHit } from "./typed-hit-resolution";
import { type BattleState, type CombatTextEvent } from "./types";

const FOLLOW_UP_CARD: BattleCard = emptyBattleCard("follow-up-typed-hit");

// Rider depth by hit phase (deliberate, not drift):
// - card hits run the full riders in damage-riders.ts (conversions, status
//   rolls, lifesteal/block/tithe, wish, brass).
// - player follow-up hits below run nature refunds and holy brass only.
// - talent follow-up hits below run holy lifesteal/block/tithe and burn forge only.
// Follow-ups stay shallow so conversion chains terminate instead of
// re-entering themselves.

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
  if (damageType === "nature") {
    nextState = applyLuckyCloverGold(nextState, modifiedDamage, combatTexts);
    nextState = applyNatureManaRefund(nextState, modifiedDamage, combatTexts);
  }
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
  if (damage <= 0 || !rollTalentChance(state.trinketEffects.brassCenserProcChance, state)) return state;
  if (rollPercent(BRASS_CENSER_SPLIT_CHANCE_PERCENT, getBattleRng(state))) {
    return dealPlayerTypedHit(state, "burn", damage, combatTexts);
  }
  return applyLifestealAndPlayerHitTriggers(state, damage, combatTexts, false, false, enemyHealthBeforeHit);
}

export function dealTalentTypedHit(
  state: BattleState,
  damageType: DamageType,
  amount: number,
  combatTexts: CombatTextEvent[],
  // Derived hits convert already-paced damage (fractions of a card hit, parting
  // cut, stun procs): they round and use the trait-only multiplier so fight
  // pacing is not applied twice. Standalone procs with fixed talent amounts
  // (wish burn, dodge burn, consume poison, frozen bonus hits) omit it and go
  // through pacing like any new damage.
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
  if (damageType === "nature") {
    nextState = applyLuckyCloverGold(nextState, resolved, combatTexts);
    nextState = applyNatureManaRefund(nextState, resolved, combatTexts);
  }
  if (damageType === "burn") {
    nextState = applyBurnForgePayout(nextState, combatTexts);
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
  return dealTalentTypedHit(
    state,
    damageType,
    sourceDamage * (damageType === "bleed" ? TALENT_CONVERSION_BLEED_FRACTION : TALENT_CONVERSION_DEFAULT_FRACTION),
    combatTexts,
    true,
  );
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
  if (enemyHealthBeforeHit < state.enemyMaxHealth / HALF_DIVISOR) {
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
