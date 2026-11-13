import {
  ELEMENTAL_REACTION_DAMAGE_PERCENT,
  ELEMENTAL_REACTION_MIN_DAMAGE,
  PERCENT_DENOMINATOR,
  REACTION_CONFIG,
} from "../game-constants";
import type { BattleSnapshot, BattleState } from "./types";

/** Earned damage, independent of turn flags and the size of the finishing hit. */
export interface ElementalReactionState {
  naturalBurnDamage: number;
  naturalPoisonDamage: number;
  naturalBleedDamage: number;
  ruptureDamage: number;
  pendingToxicShock: number;
  healingReductionTurns: number;
  weakenNextAttack: boolean;
  shatterDamage: number;
  frostfireDamage: number;
}

export function createElementalReactionState(): ElementalReactionState {
  return {
    naturalBurnDamage: 0,
    naturalPoisonDamage: 0,
    naturalBleedDamage: 0,
    ruptureDamage: 0,
    pendingToxicShock: 0,
    healingReductionTurns: 0,
    weakenNextAttack: false,
    shatterDamage: 0,
    frostfireDamage: 0,
  };
}

/** Divide first so even two safe-integer damage facts retain one exact rounding. */
export function getReactionBonus(...amounts: readonly number[]): number {
  const divisor = PERCENT_DENOMINATOR / ELEMENTAL_REACTION_DAMAGE_PERCENT;
  let whole = 0;
  let remainder = 0;
  let hasPositive = false;
  for (const amount of amounts) {
    const portion = amount % divisor;
    whole += (amount - portion) / divisor;
    remainder += portion;
    if (amount > 0) hasPositive = true;
  }
  return hasPositive ? Math.max(ELEMENTAL_REACTION_MIN_DAMAGE, whole + Math.round(remainder / divisor)) : 0;
}

export function prepareCcReactions(state: BattleState, stat: "freeze" | "stun", healthDamage: number): BattleState {
  const damage = Math.max(ELEMENTAL_REACTION_MIN_DAMAGE, getReactionBonus(healthDamage));
  return {
    ...state,
    reactions: {
      ...state.reactions,
      ...(stat === "freeze"
        ? { shatterDamage: damage, frostfireDamage: damage }
        : { ruptureDamage: damage, pendingToxicShock: isReactionDotPrepared(state, "poison") ? damage : 0 }),
    },
  };
}

export function expireCcReactions<T extends BattleSnapshot>(state: T): T {
  const { reactions, enemyCC } = state;
  if (
    (enemyCC.freezeSkipTurns > 0 || (reactions.shatterDamage === 0 && reactions.frostfireDamage === 0)) &&
    (enemyCC.stunSkipTurns > 0 || reactions.ruptureDamage === 0)
  )
    return state;
  return {
    ...state,
    reactions: {
      ...reactions,
      ...(enemyCC.freezeSkipTurns <= 0 ? { shatterDamage: 0, frostfireDamage: 0 } : {}),
      ...(enemyCC.stunSkipTurns <= 0 ? { ruptureDamage: 0 } : {}),
    },
  };
}

export function isReactionDotPrepared(state: BattleSnapshot, status: "burn" | "poison" | "bleed"): boolean {
  const key = REACTION_DOT_KEYS[status];
  const threshold = Math.max(1, Math.round(state.enemyMaxHealth * REACTION_CONFIG.setupHealthFraction));
  return state.enemyStatuses[status] >= threshold && state.reactions[key] >= threshold;
}

export const REACTION_DOT_KEYS = {
  burn: "naturalBurnDamage",
  poison: "naturalPoisonDamage",
  bleed: "naturalBleedDamage",
} as const;

export function recordNaturalReactionTick(
  state: BattleState,
  status: keyof typeof REACTION_DOT_KEYS,
  damage: number,
): BattleState {
  if (damage <= 0) return state;
  const key = REACTION_DOT_KEYS[status];
  return {
    ...state,
    reactions: { ...state.reactions, [key]: Math.min(Number.MAX_SAFE_INTEGER, state.reactions[key] + damage) },
  };
}
