import { ELEMENTAL_REACTION_DAMAGE_PERCENT, PERCENT_DENOMINATOR } from "../game-constants";
import type { BattleSnapshot, BattleState } from "./types";

/** Earned damage, independent of turn flags and the size of the finishing hit. */
export interface ElementalReactionState {
  shatterDamage: number;
  frostfireDamage: number;
  thunderclapDamage: number;
  wildfirePendingTickDamage: number | null;
  wildfireLastTickTurn: number | null;
  wildfireDamage: number;
}

export function createElementalReactionState(): ElementalReactionState {
  return {
    shatterDamage: 0,
    frostfireDamage: 0,
    thunderclapDamage: 0,
    wildfirePendingTickDamage: null,
    wildfireLastTickTurn: null,
    wildfireDamage: 0,
  };
}

export function prepareCcReactions(state: BattleState, stat: "freeze" | "stun", healthDamage: number): BattleState {
  const damage = Math.max(1, Math.round(healthDamage * (ELEMENTAL_REACTION_DAMAGE_PERCENT / PERCENT_DENOMINATOR)));
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
  // Divide before adding to retain one exact rounding even at safe-integer boundaries.
  const divisor = PERCENT_DENOMINATOR / ELEMENTAL_REACTION_DAMAGE_PERCENT;
  const damage =
    pending === null
      ? 0
      : (pending - (pending % divisor)) / divisor +
        (healthDamage - (healthDamage % divisor)) / divisor +
        Math.round(((pending % divisor) + (healthDamage % divisor)) / divisor);
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
