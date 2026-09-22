import { damageEnemyHealth, type BattleState } from "./types";

/** Eligibility is captured before reactions; Health belongs to the actual target of this hit. */
export interface HitFacts {
  readonly eligibility: BattleState;
  readonly previousHealth: number;
  readonly enemyWasAlive: boolean;
  readonly killed: boolean;
  readonly resolvedDamage: number;
  readonly healthDamage: number;
  readonly critical: boolean;
}

export function applyHitHealth(state: BattleState, resolvedDamage: number, eligibility = state, critical = false) {
  const hit = damageEnemyHealth(state, resolvedDamage);
  const facts: HitFacts = {
    eligibility,
    previousHealth: hit.previousHealth,
    enemyWasAlive: hit.enemyWasAlive,
    killed: hit.killed,
    resolvedDamage,
    healthDamage: hit.healthDamage,
    critical,
  };
  return { state: hit.state, facts };
}

export type CardHitFacts = HitFacts;
