import type { EnemyStatusId, PlayerStatusId } from "@/lib/game-data";
import { CAMPFIRE_HEAL_FRACTION, HALF_DIVISOR, PERCENT_DENOMINATOR } from "../../game-constants";
import type { GearEffectManifest } from "@/lib/gear";
import type { BattleState, CombatFlags, EnemyMitigation, FirstTimeFlagKey } from "./state-types";

const FIRST_TIME_FLAG_USED_VALUES: { [K in FirstTimeFlagKey]: CombatFlags[K] } = {
  firstPhysicalCardFreeUsed: true,
  firstHolyCardFreeUsed: true,
  firstBurnCardDoubledUsed: true,
  firstArmorCardDoubledUsed: true,
  firstPoisonCardFreeUsed: true,
  firstBleedCardFreeUsed: true,
  firstHolyDamageBonusUsed: true,
  firstBurnTrinketDoubledUsed: true,
  firstLeechCardDoubledUsed: true,
  firstConsumeCardFreeUsed: true,
  firstPotionFreeUsed: true,
  nextCardCostReduction: 0,
  resonantChimeUsedThisTurn: true,
  runicQuillUsedThisTurn: true,
};

/**
 * Snapshot first-time-per-combat flags before a non-card action (e.g., companion attack),
 * set them to their "used" sentinel values, run the mutate callback, then restore.
 */
export function withPreservedFlags(state: BattleState, mutate: (s: BattleState) => BattleState): BattleState {
  const saved: Partial<Pick<CombatFlags, FirstTimeFlagKey>> = {
    firstPhysicalCardFreeUsed: state.flags.firstPhysicalCardFreeUsed,
    firstHolyCardFreeUsed: state.flags.firstHolyCardFreeUsed,
    firstBurnCardDoubledUsed: state.flags.firstBurnCardDoubledUsed,
    firstArmorCardDoubledUsed: state.flags.firstArmorCardDoubledUsed,
    firstPoisonCardFreeUsed: state.flags.firstPoisonCardFreeUsed,
    firstBleedCardFreeUsed: state.flags.firstBleedCardFreeUsed,
    firstHolyDamageBonusUsed: state.flags.firstHolyDamageBonusUsed,
    firstBurnTrinketDoubledUsed: state.flags.firstBurnTrinketDoubledUsed,
    firstLeechCardDoubledUsed: state.flags.firstLeechCardDoubledUsed,
    firstConsumeCardFreeUsed: state.flags.firstConsumeCardFreeUsed,
    firstPotionFreeUsed: state.flags.firstPotionFreeUsed,
    nextCardCostReduction: state.flags.nextCardCostReduction,
    resonantChimeUsedThisTurn: state.flags.resonantChimeUsedThisTurn,
    runicQuillUsedThisTurn: state.flags.runicQuillUsedThisTurn,
  };
  const blockedState: BattleState = {
    ...state,
    flags: { ...state.flags, ...FIRST_TIME_FLAG_USED_VALUES },
  };
  const result = mutate(blockedState);
  return { ...result, flags: { ...result.flags, ...saved } };
}

// Immutable update helpers for BattleState. Replaces the error-prone nested spread
// pattern used ~25 times across the battle engine with one-line focused updaters.

export function addPlayerStatus(state: BattleState, status: PlayerStatusId, delta: number): BattleState {
  const bonus = status === "block" && delta > 0 ? state.gearEffects.flatBlockGained : 0;
  return {
    ...state,
    playerStatuses: { ...state.playerStatuses, [status]: state.playerStatuses[status] + delta + bonus },
  };
}

export function setPlayerStatus(state: BattleState, status: PlayerStatusId, value: number): BattleState {
  return { ...state, playerStatuses: { ...state.playerStatuses, [status]: value } };
}

export function addEnemyStatus(state: BattleState, status: EnemyStatusId, delta: number): BattleState {
  const traitAdjustedDelta =
    status === "stun" && state.currentEnemy.traits.some((trait) => trait.id === "braced")
      ? Math.round(delta / 2)
      : delta;
  let nextState = {
    ...state,
    enemyStatuses: { ...state.enemyStatuses, [status]: state.enemyStatuses[status] + traitAdjustedDelta },
  };

  if (status === "poison" && traitAdjustedDelta > 0 && nextState.gearEffects.poisonArmorShredChance > 0) {
    if (nextState.rng() * 100 < nextState.gearEffects.poisonArmorShredChance) {
      nextState = reduceEnemyArmor(nextState, 1);
    }
  }

  return nextState;
}

export function setEnemyStatus(state: BattleState, status: EnemyStatusId, value: number): BattleState {
  return { ...state, enemyStatuses: { ...state.enemyStatuses, [status]: value } };
}

export function addEnemyMitigation(state: BattleState, field: keyof EnemyMitigation, delta: number): BattleState {
  return {
    ...state,
    enemyMitigation: {
      ...state.enemyMitigation,
      [field]: state.enemyMitigation[field] + delta,
    },
  };
}

export function stripEnemyArmor(state: BattleState): BattleState {
  if (state.enemyMitigation.armor <= 0) return state;
  return { ...state, enemyMitigation: { ...state.enemyMitigation, armor: 0 } };
}

export function reduceEnemyArmor(state: BattleState, delta: number): BattleState {
  if (delta <= 0 || state.enemyMitigation.armor <= 0) return state;
  return {
    ...state,
    enemyMitigation: {
      ...state.enemyMitigation,
      armor: Math.max(0, state.enemyMitigation.armor - delta),
    },
  };
}

export function addGold(state: BattleState, delta: number): BattleState {
  const adjusted = delta > 0 ? scaleGoldReward(delta, state.gearEffects) : delta;
  return { ...state, gold: state.gold + adjusted };
}

export function setFlag<K extends keyof CombatFlags>(state: BattleState, flag: K, value: CombatFlags[K]): BattleState {
  return { ...state, flags: { ...state.flags, [flag]: value } };
}

// Adds delta (positive or negative) to current, clamped to [0, max]. NOT an absolute setter.
export function clampHealth(current: number, delta: number, max: number): number {
  return Math.max(0, Math.min(max, current + delta));
}

function computeDamageReduction(baseReduction: number, damageType: string | undefined, state: BattleState): number {
  if (damageType === "burn") {
    return baseReduction - state.talentEffects.burnDamageReduction;
  }
  if (damageType === "freeze") {
    return baseReduction - state.talentEffects.freezeDamageReduction;
  }
  if (damageType === "nature") {
    let result = baseReduction - state.talentEffects.natureDamageReduction;
    if (state.talentEffects.receiveHalfNatureDamage) {
      result = Math.round(result / HALF_DIVISOR);
    }
    return result;
  }
  if (damageType === "poison") {
    return baseReduction - state.talentEffects.poisonDamageReduction;
  }
  return baseReduction;
}

// Death's Door triggers once per battle. Subsequent zero-health hits maintain state without extra grace.
// damageReduction subtracts flat damage (e.g., from talents) before applying to health.
export function applyPlayerCombatDamage(state: BattleState, damage: number, damageType?: string): BattleState {
  if (damage <= 0) return state;
  let reducedDamage = damage - state.talentEffects.damageReduction;
  if (state.activeCompanion && state.talentEffects.damageReductionWithCompanion > 0) {
    reducedDamage -= state.talentEffects.damageReductionWithCompanion;
  }
  reducedDamage = computeDamageReduction(reducedDamage, damageType, state);
  reducedDamage = Math.max(0, reducedDamage);
  reducedDamage = applyGearDamageResistance(reducedDamage, damageType, state.gearEffects);
  const nextHealth = clampHealth(state.playerHealth, -reducedDamage, state.playerMaxHealth);
  if (nextHealth > 0) return { ...state, playerHealth: nextHealth };
  if (state.playerStatuses.phoenixFeather > 0) {
    const healAmount = Math.ceil(state.playerMaxHealth * CAMPFIRE_HEAL_FRACTION);
    return {
      ...state,
      playerHealth: healAmount,
      playerStatuses: { ...state.playerStatuses, phoenixFeather: 0 },
      deathsDoorActive: false,
      deathsDoorTriggeredTurn: null,
      deathsDoorGraceTurnsRemaining: null,
    };
  }
  if (!state.deathsDoorUsed) {
    return {
      ...state,
      playerHealth: 1,
      deathsDoorUsed: true,
      deathsDoorActive: true,
      deathsDoorTriggeredTurn: state.turn,
      deathsDoorGraceTurnsRemaining: 1 + Math.max(0, state.talentEffects.deathsDoorExtension),
    };
  }
  return { ...state, playerHealth: 0, deathsDoorActive: false };
}

// Healing with Death's Door active removes protection — healing saves you but costs the grace window.
export function applyPlayerHealing(state: BattleState, amount: number): BattleState {
  const playerHealth = clampHealth(state.playerHealth, amount, state.playerMaxHealth);
  const overheal = state.playerHealth + amount - playerHealth;
  const healedOnDeathsDoor = state.deathsDoorActive && amount > 0;
  let nextState = {
    ...state,
    playerHealth,
    deathsDoorActive: healedOnDeathsDoor ? false : state.deathsDoorActive,
    deathsDoorTriggeredTurn: healedOnDeathsDoor ? null : state.deathsDoorTriggeredTurn,
    deathsDoorGraceTurnsRemaining: healedOnDeathsDoor ? null : state.deathsDoorGraceTurnsRemaining,
  };
  if (overheal > 0 && nextState.talentEffects.overhealToBlockRatio > 0) {
    const blockGain = Math.round(overheal * nextState.talentEffects.overhealToBlockRatio);
    nextState = addPlayerStatus(nextState, "block", blockGain);
  }
  return nextState;
}

export function applyGearDamageResistance(
  damage: number,
  damageType: string | undefined,
  gear: GearEffectManifest,
): number {
  const RESIST_BY_DAMAGE_TYPE: Record<string, keyof GearEffectManifest> = {
    physical: "resistPhysical",
    stun: "resistStun",
    holy: "resistHoly",
    burn: "resistBurn",
    poison: "resistPoison",
    bleed: "resistBleed",
    freeze: "resistFreeze",
    nature: "resistNature",
  };
  const key = damageType ? RESIST_BY_DAMAGE_TYPE[damageType] : undefined;
  const resist = key ? gear[key] : 0;
  if (resist <= 0) return damage;
  return Math.max(0, Math.round(damage * (1 - resist / PERCENT_DENOMINATOR)));
}

export function scaleGoldReward(baseGold: number, gear: GearEffectManifest): number {
  if (gear.goldGainPercent <= 0) return baseGold;
  return Math.round(baseGold * (1 + gear.goldGainPercent / PERCENT_DENOMINATOR));
}

export function isPlayerDefeated(state: Pick<BattleState, "playerHealth" | "deathsDoorActive">): boolean {
  return state.playerHealth <= 0 && !state.deathsDoorActive;
}
