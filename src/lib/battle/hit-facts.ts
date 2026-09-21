import { damageEnemyHealth, type BattleState } from "./types";

/** Eligibility is captured before reactions; Health belongs to the actual target of this hit. */
export interface HitFacts {
  readonly eligibility: BattleState;
  readonly previousHealth: number;
  readonly enemyWasAlive: boolean;
  readonly killed: boolean;
  readonly resolvedDamage: number;
  readonly healthDamage: number;
}

export function applyHitHealth(state: BattleState, resolvedDamage: number, eligibility = state) {
  const hit = damageEnemyHealth(state, resolvedDamage);
  const facts: HitFacts = {
    eligibility,
    previousHealth: hit.previousHealth,
    enemyWasAlive: hit.enemyWasAlive,
    killed: hit.killed,
    resolvedDamage,
    healthDamage: hit.healthDamage,
  };
  return { state: hit.state, facts };
}

export interface CardHitFacts extends HitFacts {
  readonly hawkEyeReady: boolean;
}
