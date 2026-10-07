import type { BattleCard, BattleCardEffect, BattleCardEffectKind } from "@/lib/game-data";
import type { BattleState, CombatTextEvent } from "../types";

export interface AttackBonuses {
  flat: number;
  physical: number;
  bleed: number;
}

export interface CardEffectResolutionContext {
  manaAtStart: number;
  enemyFreezeSkipTurnsAtStart: number;
  origin?: "played-card" | "triggered-card" | "companion";
  // Execution-local pool shared by effects of one action, including play-twice.
  // Consume at the attack-attempt boundary, even when the attack is dodged.
  attackBonuses?: AttackBonuses;
  damageEffects?: Array<Extract<BattleCardEffect, { kind: "damage" }>>;
  onDamageDealt?: (amount: number) => void;
  damageMultiplier?: number;
  baseDamageBonus?: number;
  guaranteedCrit?: boolean;
}

export function consumeAttackBonuses(context: CardEffectResolutionContext | undefined): AttackBonuses {
  const bonuses = { flat: 0, physical: 0, bleed: 0, ...context?.attackBonuses };
  if (context?.attackBonuses) Object.assign(context.attackBonuses, { flat: 0, physical: 0, bleed: 0 });
  return bonuses;
}

export function hasCardHealing(context: CardEffectResolutionContext | undefined): boolean {
  return context?.origin === "played-card" || context?.origin === "triggered-card";
}

export type EffectHandler<K extends BattleCardEffectKind = BattleCardEffectKind> = (
  state: BattleState,
  card: BattleCard,
  effect: Extract<BattleCardEffect, { kind: K }>,
  potionMult: number,
  combatTexts: CombatTextEvent[],
  context?: CardEffectResolutionContext,
) => BattleState;

export function ccDeepenedSinceStart(current: number, atStart: number | undefined): boolean {
  return current > (atStart ?? current);
}

/** Table keys determine the effect type; recursive effects belong to orchestration. */
export type EffectHandlers = {
  [K in Exclude<BattleCardEffectKind, "chance" | "repeat-over-turns">]: EffectHandler<K>;
};
