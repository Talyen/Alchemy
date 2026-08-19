import type { EnemyStatusId, PlayerStatusId } from "@/lib/game-data";
import {
  CAMPFIRE_HEAL_FRACTION,
  DEATHS_DOOR_GRACE_TURNS,
  HALF_DIVISOR,
  PERCENT_DENOMINATOR,
} from "../../game-constants";
import type { GearEffectManifest } from "@/lib/gear";
import type { BattleState, CombatFlags, EnemyMitigation, FirstTimeFlagKey } from "./state-types";

const FIRST_TIME_FLAG_USED_VALUES: { [K in FirstTimeFlagKey]: CombatFlags[K] } = {
  firstHolyCardFreeUsed: true,
  firstBurnCardDoubledUsed: true,
  firstArmorCardDoubledUsed: true,
  firstPoisonCardFreeUsed: true,
  firstBleedCardFreeUsed: true,
  firstHolyDamageBonusUsed: true,
  firstBurnTrinketDoubledUsed: true,
  firstLeechCardDoubledUsed: true,
  firstConsumeCardFreeUsed: true,
  firstCompanionCardFreeUsed: true,
  firstArcheryCardFreeUsed: true,
  firstPotionFreeUsed: true,
  nextCardCostReduction: 0,
  resonantChimeUsedThisTurn: true,
  runicQuillUsedThisTurn: true,
  consumeDrawUsedThisTurn: true,
};

/** Armed player-card flags: force inactive so companions/pulses neither benefit nor consume. */
const NON_CARD_INACTIVE_FLAGS = {
  nextHitCrit: false,
  playNextCardTwice: false,
} as const satisfies Partial<CombatFlags>;

const PRESERVED_NON_CARD_FLAG_VALUES = {
  ...FIRST_TIME_FLAG_USED_VALUES,
  ...NON_CARD_INACTIVE_FLAGS,
};

type PreservedNonCardFlagKey = keyof typeof PRESERVED_NON_CARD_FLAG_VALUES;

/**
 * Snapshot first-time-per-combat flags before a non-card action (e.g., companion attack),
 * set them to their "used" sentinel values, run the mutate callback, then restore.
 */
export function withPreservedFlags(state: BattleState, mutate: (s: BattleState) => BattleState): BattleState {
  const saved = Object.fromEntries(
    (Object.keys(PRESERVED_NON_CARD_FLAG_VALUES) as PreservedNonCardFlagKey[]).map((key) => [key, state.flags[key]]),
  ) as Partial<Pick<CombatFlags, PreservedNonCardFlagKey>>;
  const blockedState: BattleState = {
    ...state,
    flags: { ...state.flags, ...PRESERVED_NON_CARD_FLAG_VALUES },
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
    return baseReduction - state.talentEffects.natureDamageReduction;
  }
  if (damageType === "poison") {
    return baseReduction - state.talentEffects.poisonDamageReduction;
  }
  return baseReduction;
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
