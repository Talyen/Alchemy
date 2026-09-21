import type { BattleCard, BattleCardEffect, BattleCardEffectKind } from "@/lib/game-data";
import type { BattleState, CombatTextEvent } from "../types";

export interface AttackBonuses {
  flat: number;
  physical: number;
  bleed: number;
  sanguine?: number;
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

export function consumeAttackBonuses(context: CardEffectResolutionContext | undefined): Required<AttackBonuses> {
  const bonuses = { flat: 0, physical: 0, bleed: 0, sanguine: 0, ...context?.attackBonuses };
  if (context?.attackBonuses) Object.assign(context.attackBonuses, { flat: 0, physical: 0, bleed: 0, sanguine: 0 });
  return bonuses;
}

export function hasCardHealing(context: CardEffectResolutionContext | undefined): boolean {
  return context?.origin === "played-card" || context?.origin === "triggered-card";
}

export type EffectHandler = (
  state: BattleState,
  card: BattleCard,
  effect: BattleCardEffect,
  potionMult: number,
  combatTexts: CombatTextEvent[],
  context?: CardEffectResolutionContext,
) => BattleState;

export function ccDeepenedSinceStart(current: number, atStart: number | undefined): boolean {
  return current > (atStart ?? current);
}

export function defineHandler<K extends BattleCardEffectKind>(
  kind: K,
  fn: (
    state: BattleState,
    card: BattleCard,
    effect: Extract<BattleCardEffect, { kind: K }>,
    potionMult: number,
    combatTexts: CombatTextEvent[],
    context: CardEffectResolutionContext | undefined,
  ) => BattleState,
): EffectHandler {
  return (state, card, effect, potionMult, combatTexts, context) => {
    if (effect.kind !== kind) {
      throw new Error(`[Battle] handler mismatch: expected ${kind} got ${effect.kind}`);
    }
    return fn(state, card, effect as Extract<BattleCardEffect, { kind: K }>, potionMult, combatTexts, context);
  };
}
