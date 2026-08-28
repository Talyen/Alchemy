import { clamp } from "@/lib/utils";
import type { EnemyStatusId, PlayerStatusId } from "@/lib/game-data";
import {
  CAMPFIRE_HEAL_FRACTION,
  DEATHS_DOOR_GRACE_TURNS,
  HALF_DIVISOR,
  PERCENT_DENOMINATOR,
} from "../../game-constants";
import type { GearEffectManifest } from "@/lib/gear";
import { rollPercent } from "../rng";
import type { BattleState, CombatFlags, EnemyMitigation } from "./state-types";
import { isStunFreezeBuildupBlocked } from "./state-types";
import { PRESERVED_FLAG_KEYS, PRESERVED_FLAG_VALUES, type PreservedFlagKey } from "../combat-flags";

/**
 * Snapshot card-play flags before a non-card action (e.g., companion attack),
 * set them to their inactive sentinel (used/empty), run the mutate callback, then restore.
 * Single source is FLAG_DEFINITIONS.preserveAs — no second map to keep in sync.
 */
export function withPreservedFlags(state: BattleState, mutate: (s: BattleState) => BattleState): BattleState {
  const saved: Partial<Pick<CombatFlags, PreservedFlagKey>> = {};
  for (const key of PRESERVED_FLAG_KEYS) {
    saved[key] = state.flags[key] as never;
  }
  const blockedState: BattleState = {
    ...state,
    flags: { ...state.flags, ...PRESERVED_FLAG_VALUES },
  };
  const result = mutate(blockedState);
  return { ...result, flags: { ...result.flags, ...saved } };
}

// Immutable update helpers for BattleState. Replaces the error-prone nested spread
// pattern used ~25 times across the battle engine with one-line focused updaters.

/** Effective delta after gear bonuses; positive block gains add flatBlockGained. */
export function playerStatusDelta(state: BattleState, status: PlayerStatusId, delta: number): number {
  return status === "block" && delta > 0 ? delta + state.gearEffects.flatBlockGained : delta;
}

export function addPlayerStatus(state: BattleState, status: PlayerStatusId, delta: number): BattleState {
  if ((status === "stun" || status === "freeze") && isStunFreezeBuildupBlocked(state.playerCC)) {
    return state;
  }
  return {
    ...state,
    playerStatuses: {
      ...state.playerStatuses,
      [status]: state.playerStatuses[status] + playerStatusDelta(state, status, delta),
    },
  };
}

/** Clears or ticks a status. Positive stun/freeze buildup must go through `addPlayerStatus`. */
export function setPlayerStatus(state: BattleState, status: PlayerStatusId, value: number): BattleState {
  return { ...state, playerStatuses: { ...state.playerStatuses, [status]: value } };
}

export function addEnemyStatus(state: BattleState, status: EnemyStatusId, delta: number): BattleState {
  if ((status === "stun" || status === "freeze") && isStunFreezeBuildupBlocked(state.enemyCC)) {
    return state;
  }
  const traitAdjustedDelta =
    status === "stun" && state.currentEnemy.traits.some((trait) => trait.id === "braced")
      ? Math.round(delta / HALF_DIVISOR)
      : delta;
  let nextState = {
    ...state,
    enemyStatuses: { ...state.enemyStatuses, [status]: state.enemyStatuses[status] + traitAdjustedDelta },
  };

  // Sole shred roll owner: every poison application strips once, whatever its
  // source (hits stack through here too; ticks are not applications).
  if (
    status === "poison" &&
    traitAdjustedDelta > 0 &&
    rollPercent(nextState.gearEffects.poisonArmorShredChance, nextState.rng)
  ) {
    nextState = reduceEnemyArmor(nextState, 1);
  }

  return nextState;
}

/** Clears or ticks a status. Positive stun/freeze buildup must go through `addEnemyStatus`. */
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

export function stripEnemyBlock(state: BattleState): BattleState {
  if (state.enemyMitigation.block <= 0) return state;
  return { ...state, enemyMitigation: { ...state.enemyMitigation, block: 0 } };
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

export function setFlag<K extends keyof CombatFlags>(state: BattleState, flag: K, value: CombatFlags[K]): BattleState {
  return { ...state, flags: { ...state.flags, [flag]: value } };
}

// Adds delta (positive or negative) to current, clamped to [0, max]. NOT an absolute setter.
// Non-finite inputs are load-bearing corruption — preserve current health and clamp
// to a sane max rather than killing the player with a 0 fallback.
export function clampHealth(current: number, delta: number, max: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(delta) || !Number.isFinite(max)) {
    const safeCurrent = Number.isFinite(current) ? current : 0;
    const safeMax = Number.isFinite(max) && max > 0 ? max : safeCurrent;
    const safeDelta = Number.isFinite(delta) ? delta : 0;
    return clamp(safeCurrent + safeDelta, 0, safeMax);
  }
  return clamp(current + delta, 0, max);
}

/** Adds mana clamped at maxMana — overcap is discarded, never carried into later turns. */
export function gainMana(state: BattleState, amount: number): BattleState {
  if (amount <= 0) return state;
  return { ...state, mana: Math.min(state.maxMana, state.mana + amount) };
}

function computeDamageReduction(damage: number, damageType: string | undefined, state: BattleState): number {
  if (damageType === "burn") return damage - state.talentEffects.burnDamageReduction;
  if (damageType === "freeze") return damage - state.talentEffects.freezeDamageReduction;
  if (damageType === "nature") return damage - state.talentEffects.natureDamageReduction;
  if (damageType === "poison") return damage - state.talentEffects.poisonDamageReduction;
  return damage;
}

/** Halves incoming player damage when the matching resist talent is unlocked. */
export function scaleReceivedPlayerDamage(
  damage: number,
  talentEffects: BattleState["talentEffects"],
  damageType: string | undefined,
): number {
  if (damage <= 0) return damage;
  const receiveHalf =
    (damageType === "burn" && talentEffects.receiveHalfBurnDamage) ||
    (damageType === "holy" && talentEffects.receiveHalfHolyDamage) ||
    (damageType === "freeze" && talentEffects.receiveHalfFreezeDamage) ||
    (damageType === "poison" && talentEffects.receiveHalfPoisonDamage) ||
    (damageType === "bleed" && talentEffects.receiveHalfBleedDamage) ||
    (damageType === "nature" && talentEffects.receiveHalfNatureDamage);
  return receiveHalf ? Math.round(damage / HALF_DIVISOR) : damage;
}

export function deathsDoorGraceTurns(extension: number): number {
  return DEATHS_DOOR_GRACE_TURNS + Math.max(0, extension);
}

// Death's Door triggers once per battle. During the grace window (deathsDoorActive)
// lethal hits floor the player at 1 HP. Healing does not dismiss the window.
// Once grace expires, the next lethal hit after that enemy phase can kill.
// damageReduction subtracts flat damage (e.g., from talents) before applying to health.
export function applyPlayerCombatDamage(state: BattleState, damage: number, damageType?: string): BattleState {
  if (!Number.isFinite(damage) || damage <= 0) return state;
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
    const healAmount = Math.round(state.playerMaxHealth * CAMPFIRE_HEAL_FRACTION);
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
      deathsDoorGraceTurnsRemaining: deathsDoorGraceTurns(state.talentEffects.deathsDoorExtension),
    };
  }
  if (state.deathsDoorActive) {
    return { ...state, playerHealth: 1 };
  }
  return { ...state, playerHealth: 0, deathsDoorActive: false };
}

export function applyPlayerHealing(state: BattleState, amount: number): BattleState {
  const playerHealth = clampHealth(state.playerHealth, amount, state.playerMaxHealth);
  const overheal = state.playerHealth + amount - playerHealth;
  let nextState = {
    ...state,
    playerHealth,
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
