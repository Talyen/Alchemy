import {
  ELEMENTAL_REACTION_DAMAGE_PERCENT,
  ELEMENTAL_REACTION_MIN_DAMAGE,
  PERCENT_DENOMINATOR,
} from "../game-constants";
import type { BattleSnapshot, BattleState } from "./types";

/** Earned damage, independent of turn flags and the size of the finishing hit. */
export interface ElementalReactionState {
  shatterDamage: number;
  frostfireDamage: number;
  thunderclapDamage: number;
  wildfirePendingTickDamage: number | null;
  wildfireLastTickTurn: number | null;
  wildfireDamage: number;
  consecrated: boolean;
}

export function createElementalReactionState(): ElementalReactionState {
  return {
    shatterDamage: 0,
    frostfireDamage: 0,
    thunderclapDamage: 0,
    wildfirePendingTickDamage: null,
    wildfireLastTickTurn: null,
    wildfireDamage: 0,
    consecrated: false,
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
      ...(stat === "freeze" ? { shatterDamage: damage, frostfireDamage: damage } : { thunderclapDamage: damage }),
    },
  };
}

export function expireCcReactions<T extends BattleSnapshot>(state: T): T {
  const { reactions, enemyCC } = state;
  if (
    (enemyCC.freezeSkipTurns > 0 || (reactions.shatterDamage === 0 && reactions.frostfireDamage === 0)) &&
    (enemyCC.stunSkipTurns > 0 || reactions.thunderclapDamage === 0)
  )
    return state;
  return {
    ...state,
    reactions: {
      ...reactions,
      ...(enemyCC.freezeSkipTurns <= 0 ? { shatterDamage: 0, frostfireDamage: 0 } : {}),
      ...(enemyCC.stunSkipTurns <= 0 ? { thunderclapDamage: 0 } : {}),
    },
  };
}

/** Called only by the natural enemy-turn Burn tick, never by bonus ticks or detonations. */
export function recordWildfireTick(state: BattleState, healthDamage: number): BattleState {
  if (healthDamage <= 0 || state.reactions.wildfireLastTickTurn === state.turn) return state;
  const pending = state.reactions.wildfirePendingTickDamage;
  const damage = pending === null ? 0 : getReactionBonus(pending, healthDamage);
  return {
    ...state,
    reactions: {
      ...state.reactions,
      wildfirePendingTickDamage: pending === null ? healthDamage : null,
      wildfireLastTickTurn: state.turn,
      wildfireDamage: Math.min(Number.MAX_SAFE_INTEGER, state.reactions.wildfireDamage + damage),
    },
  };
}
