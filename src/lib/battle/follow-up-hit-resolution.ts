import { resolveSecondaryAction } from "./action-context";
import type { DamageType, TalentEffectManifest } from "@/lib/game-data";
import { getBattleRng, rollPercent } from "@/lib/rng";
import {
  BRASS_CENSER_SPLIT_CHANCE_PERCENT,
  HALF_DIVISOR,
  TALENT_CONVERSION_BLEED_FRACTION,
  TALENT_CONVERSION_DEFAULT_FRACTION,
} from "../game-constants";
import {
  applyBurnForgePayout,
  applyLuckyCloverGold,
  applyNatureGoldReward,
  applyNatureManaRefund,
} from "./bonus-effects";
import { computeCardDamageToEnemy, computeTalentDamageToEnemy } from "./damage-calc";
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

import type { FollowUpHitRequest } from "./hit-request";

/** Lower resolution tier: Wish and other reactions can emit shallow hits without importing card orchestration. */
export function resolveFollowUpHit(
  state: BattleState,
  request: FollowUpHitRequest,
  combatTexts: CombatTextEvent[],
): BattleState {
  switch (request.source) {
    case "player-follow-up":
      return resolveSecondaryAction(state, "reward", (current) =>
        resolvePlayerFollowUp(current, request.damageType, request.amount, combatTexts),
      );
    case "talent-fixed":
    case "talent-derived":
      return resolveTalentFollowUp(state, request, combatTexts);
  }
}

function resolvePlayerFollowUp(
  state: BattleState,
  damageType: DamageType,
  amount: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  if (amount <= 0 || state.enemyHealth <= 0) return state;
  const effect = { kind: "damage" as const, damageType, amount };
  const { nextState: afterMods, modifiedDamage, critical } = computeCardDamageToEnemy(state, effect);
  const hit = resolveTypedEnemyHit(afterMods, effect, modifiedDamage, combatTexts, state, {
    critical,
    onPoisonBleedConversion: (current, damage, texts) =>
      resolveFollowUpHit(current, { source: "talent-derived", damageType: "bleed", amount: damage }, texts),
    onPoisonDamage: tryPoisonStunProc,
  });
  const preHitHealth = hit.facts.previousHealth;
  let nextState = hit.state;
  if (damageType === "nature") {
    nextState = applyLuckyCloverGold(nextState, modifiedDamage, combatTexts);
    nextState = applyNatureGoldReward(nextState, hit.facts.healthDamage, combatTexts);
    nextState = applyNatureManaRefund(nextState, modifiedDamage, combatTexts);
  }
  return damageType === "holy" ? applyBrassCenser(nextState, modifiedDamage, combatTexts, preHitHealth) : nextState;
}

export function tryPoisonStunProc(state: BattleState, damage: number, combatTexts: CombatTextEvent[]): BattleState {
  if (damage <= 0) return state;
  if (!rollTalentChance(state.talentEffects.poisonStunChance, state)) return state;
  return resolveFollowUpHit(state, { source: "talent-derived", damageType: "stun", amount: damage }, combatTexts);
}

export function applyBrassCenser(
  state: BattleState,
  damage: number,
  combatTexts: CombatTextEvent[],
  enemyHealthBeforeHit = state.enemyHealth,
): BattleState {
  if (damage <= 0 || !rollTalentChance(state.trinketEffects.brassCenserProcChance, state)) return state;
  if (rollPercent(BRASS_CENSER_SPLIT_CHANCE_PERCENT, getBattleRng(state))) {
    return resolveFollowUpHit(state, { source: "player-follow-up", damageType: "burn", amount: damage }, combatTexts);
  }
  return applyLifestealAndPlayerHitTriggers(state, damage, combatTexts, false, false, enemyHealthBeforeHit);
}

function resolveTalentFollowUp(
  state: BattleState,
  request: Extract<FollowUpHitRequest, { source: "talent-fixed" | "talent-derived" }>,
  combatTexts: CombatTextEvent[],
): BattleState {
  const { damageType, amount, source } = request;
  if (amount <= 0 || state.enemyHealth <= 0) return state;
  const { state: blocked, remainingDamage: resolved } = computeTalentDamageToEnemy(state, damageType, amount, source);
  if (resolved <= 0) return blocked;
  const hit = resolveTypedEnemyHit(blocked, { kind: "damage", damageType, amount }, resolved, combatTexts, state, {
    allowPoisonBleedConversion: false,
    allowTalentChanceProcs: false,
    onPoisonBleedConversion: (current, damage, texts) =>
      resolveFollowUpHit(current, { source: "talent-derived", damageType: "bleed", amount: damage }, texts),
  });
  let nextState = hit.state;
  if (damageType === "holy") {
    nextState = applyHolyLifesteal(nextState, resolved, combatTexts, hit.facts.eligibility);
    nextState = applyDamageBlock(nextState, resolved, combatTexts, hit.facts.eligibility);
    nextState = applyHolyTithe(nextState, resolved, combatTexts);
  }
  if (damageType === "nature") {
    nextState = applyLuckyCloverGold(nextState, resolved, combatTexts);
    nextState = applyNatureGoldReward(nextState, hit.facts.healthDamage, combatTexts);
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
  fraction = damageType === "bleed" ? TALENT_CONVERSION_BLEED_FRACTION : TALENT_CONVERSION_DEFAULT_FRACTION,
): BattleState {
  if (sourceDamage <= 0 || state.enemyHealth <= 0 || !rollTalentChance(chance, state)) return state;
  return resolveFollowUpHit(
    state,
    {
      source: "talent-derived",
      damageType,
      amount: sourceDamage * fraction,
    },
    combatTexts,
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
    nextState = resolveFollowUpHit(
      nextState,
      { source: "talent-fixed", damageType: "holy", amount: state.talentEffects.leechHolyDamageVsLowHealth },
      combatTexts,
    );
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
  fraction?: number;
}

const TALENT_HIT_CONVERSIONS: Record<ConversionSource, readonly HitConversion[]> = {
  physical: [{ chance: "physicalBleedDamageChance", target: "bleed" }],
  bleed: [{ chance: "bleedPoisonDamageChance", target: "poison" }],
  nature: [{ chance: "naturePoisonDamageChance", target: "poison" }],
  holy: [{ chance: "holyBurnDamageChance", target: "burn", fraction: 1 }],
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
    next = tryTalentTypedHit(
      next,
      state.talentEffects[reaction.chance],
      reaction.target,
      damage,
      combatTexts,
      reaction.fraction,
    );
  }
  return next;
}
