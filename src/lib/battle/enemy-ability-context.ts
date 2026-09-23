import { HALF_DIVISOR } from "../game-constants";
import { getEnemyTraitSet, hasEnemyTrait, type BattleState } from "./types";

/** Scratch facts shared by the ordered effects and follow-ups of one ability. */
export interface EnemyAbilityContext {
  readonly traitSet: ReadonlySet<string>;
  readonly rewardedTraits: Set<string>;
  readonly brawlerPenalty: boolean;
  readonly vampireBonus: boolean;
  landed: boolean;
  healthDamage: number;
}

export function createEnemyAbilityContext(state: BattleState, damaging: boolean): EnemyAbilityContext {
  return {
    traitSet: getEnemyTraitSet(state),
    rewardedTraits: new Set(),
    brawlerPenalty: damaging && state.flags.enemyBrawlerDamagePenalty,
    vampireBonus:
      damaging && hasEnemyTrait(state, "vampire") && state.playerHealth < state.playerMaxHealth / HALF_DIVISOR,
    landed: false,
    healthDamage: 0,
  };
}

export function recordEnemyAbilityHit(
  context: EnemyAbilityContext,
  hit: { landed: boolean; healthDamage: number },
): void {
  context.landed ||= hit.landed;
  context.healthDamage += hit.healthDamage;
}
