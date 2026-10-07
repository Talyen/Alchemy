import { rollBattleChance } from "./chance-roll";
import { resolveSecondaryAction } from "./action-context";
import type { DamageType, TalentEffectManifest } from "@/lib/game-data";
import { getBattleRng, rollPercent } from "@/lib/rng";
import {
  BRASS_CENSER_SPLIT_CHANCE_PERCENT,
  TALENT_CONVERSION_BLEED_FRACTION,
  TALENT_CONVERSION_DEFAULT_FRACTION,
} from "../game-constants";
import {
  applyBurnForgePayout,
  applyEmberforgedPayout,
  applyLuckyCloverGold,
  applyNatureGoldReward,
  applyNatureManaRefund,
} from "./bonus-effects";
import { computeCardDamageToEnemy, computeTalentDamageToEnemy } from "./damage-calc";
import {
  applyDamageBlock,
  applyHolyLifesteal,
  applyHolyBlockChance,
  applyHolyTithe,
  applyLeechHitHealing,
  applyThunderstoneLeech,
} from "./damage-rider-leech";
export { applyLeechHitHealing as applyLifestealAndPlayerHitTriggers } from "./damage-rider-leech";
import { resolveTypedEnemyHit } from "./typed-hit-resolution";
import { resolveStunFollowUpHit } from "./stun-follow-up-hit";
import { type BattleState, type CombatTextEvent } from "./types";
import type { FollowUpHitRequest } from "./player-hit-core";

/** Lower resolution tier: Wish and other reactions can emit shallow hits without importing card orchestration. */
export function resolveFollowUpHit(
  state: BattleState,
  request: FollowUpHitRequest,
  combatTexts: CombatTextEvent[],
): BattleState {
  switch (request.source) {
    case "player-follow-up":
      if (request.damageType === "stun")
        return resolveStunFollowUpHit(state, request.amount, combatTexts, applyThunderstoneLeech);
      return resolveSecondaryAction(state, "reward", (current) =>
        resolveDerivedFollowUp(
          current,
          request.damageType,
          request.amount,
          request.source,
          combatTexts,
          "onDamageDealt" in request ? request.onDamageDealt : undefined,
        ),
      );
    case "talent-fixed":
    case "talent-derived":
      return resolveTalentFollowUp(state, request, combatTexts);
  }
}

function resolveDerivedFollowUp(
  state: BattleState,
  damageType: DamageType,
  amount: number,
  source: FollowUpHitRequest["source"],
  combatTexts: CombatTextEvent[],
  onDamageDealt?: (amount: number) => void,
): BattleState {
  if (amount <= 0 || state.enemyHealth <= 0) return state;
  const isPlayer = source === "player-follow-up";
  const effect = { kind: "damage" as const, damageType, amount };
  let base: BattleState;
  let resolved: number;
  let critical = false;
  if (isPlayer) {
    const mods = computeCardDamageToEnemy(state, effect);
    base = mods.nextState;
    resolved = mods.modifiedDamage;
    critical = mods.critical;
  } else {
    const blocked = computeTalentDamageToEnemy(state, damageType, amount, source);
    if (blocked.remainingDamage <= 0) return blocked.state;
    base = blocked.state;
    resolved = blocked.remainingDamage;
  }
  const hit = resolveTypedEnemyHit(base, effect, resolved, combatTexts, state, {
    critical,
    ...(isPlayer ? {} : { allowPoisonBleedConversion: false as const }),
    onPoisonBleedConversion: (current, damage, texts) =>
      resolveFollowUpHit(current, { source: "talent-derived", damageType: "bleed", amount: damage }, texts),
    ...(isPlayer ? { onPoisonDamage: tryPoisonStunProc } : {}),
  });
  onDamageDealt?.(hit.facts.healthDamage);
  let nextState = hit.state;
  if (damageType === "nature") {
    nextState = applyFollowUpNatureRiders(nextState, resolved, hit.facts.healthDamage, state, combatTexts);
  }
  if (damageType === "holy") {
    if (!isPlayer) nextState = applyHolyLifesteal(nextState, resolved, combatTexts, hit.facts.eligibility);
    nextState = applyHolyBlockChance(nextState, hit.facts.healthDamage, combatTexts);
    if (!isPlayer) {
      nextState = applyDamageBlock(nextState, resolved, combatTexts, hit.facts.eligibility);
      nextState = applyHolyTithe(nextState, hit.facts.healthDamage, combatTexts);
    } else {
      nextState = applyBrassCenser(nextState, resolved, combatTexts);
    }
  }
  if (damageType === "burn" && (isPlayer ? hit.facts.healthDamage > 0 : true)) {
    nextState = isPlayer
      ? applyEmberforgedPayout(nextState, combatTexts, state.enemyStatuses.burn > 0)
      : applyBurnForgePayout(nextState, combatTexts, hit.facts.eligibility.enemyStatuses.burn > 0);
  }
  return nextState;
}

function applyFollowUpNatureRiders(
  state: BattleState,
  damage: number,
  healthDamage: number,
  eligibility: BattleState,
  combatTexts: CombatTextEvent[],
): BattleState {
  let nextState = state;
  if (eligibility.gearEffects.natureLeechVsPoisoned > 0 && eligibility.enemyStatuses.poison > 0 && healthDamage > 0) {
    nextState = applyLeechHitHealing(nextState, healthDamage, combatTexts);
  }
  nextState = applyLuckyCloverGold(nextState, healthDamage, combatTexts);
  nextState = applyNatureGoldReward(nextState, healthDamage, combatTexts);
  return applyNatureManaRefund(nextState, damage, combatTexts);
}

export function tryPoisonStunProc(state: BattleState, damage: number, combatTexts: CombatTextEvent[]): BattleState {
  if (damage <= 0) return state;
  if (!rollBattleChance(state.talentEffects.poisonStunChance, state)) return state;
  return resolveFollowUpHit(state, { source: "talent-derived", damageType: "stun", amount: damage }, combatTexts);
}

export function applyBrassCenser(state: BattleState, damage: number, combatTexts: CombatTextEvent[]): BattleState {
  if (damage <= 0 || !rollBattleChance(state.trinketEffects.brassCenserProcChance, state)) return state;
  if (rollPercent(BRASS_CENSER_SPLIT_CHANCE_PERCENT, getBattleRng(state))) {
    return resolveFollowUpHit(state, { source: "player-follow-up", damageType: "burn", amount: damage }, combatTexts);
  }
  return applyLeechHitHealing(state, damage, combatTexts);
}

function resolveTalentFollowUp(
  state: BattleState,
  request: Extract<FollowUpHitRequest, { source: "talent-fixed" | "talent-derived" }>,
  combatTexts: CombatTextEvent[],
): BattleState {
  return resolveDerivedFollowUp(state, request.damageType, request.amount, request.source, combatTexts);
}

export function tryTalentTypedHit(
  state: BattleState,
  chance: number,
  damageType: "burn" | "poison" | "bleed",
  sourceDamage: number,
  combatTexts: CombatTextEvent[],
  fraction = damageType === "bleed" ? TALENT_CONVERSION_BLEED_FRACTION : TALENT_CONVERSION_DEFAULT_FRACTION,
): BattleState {
  if (sourceDamage <= 0 || state.enemyHealth <= 0 || !rollBattleChance(chance, state)) return state;
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

export function applyNatureLeech(
  state: BattleState,
  damage: number,
  combatTexts: CombatTextEvent[],
  guaranteed = false,
) {
  if (damage <= 0) return state;
  const leechChance = state.talentEffects.natureLeechChance + state.gearEffects.natureLeechChance;
  if (!guaranteed && (leechChance <= 0 || !rollBattleChance(leechChance, state))) return state;
  return applyLeechHitHealing(state, damage, combatTexts);
}

type ConversionSource = "physical" | "bleed" | "nature" | "holy";
type NumericTalentEffect = {
  [K in keyof TalentEffectManifest]: TalentEffectManifest[K] extends number ? K : never;
}[keyof TalentEffectManifest];
interface HitConversion {
  chance: NumericTalentEffect;
  target: "burn" | "poison" | "bleed";
  fraction?: number;
}

const TALENT_HIT_CONVERSIONS: Record<ConversionSource, readonly HitConversion[]> = {
  physical: [{ chance: "physicalBleedChance", target: "bleed" }],
  bleed: [{ chance: "bleedPoisonDamageChance", target: "poison" }],
  nature: [
    { chance: "naturePoisonChance", target: "poison" },
    { chance: "natureBleedChance", target: "bleed" },
  ],
  holy: [{ chance: "holyBurnDamageChance", target: "burn", fraction: 1 }],
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
