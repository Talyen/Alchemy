import type { BattleCard, BattleCardEffect, BattleCardEffectKind } from "@/lib/game-data";
import type { BattleState, CombatTextEvent } from "../types";

export interface CardEffectResolutionContext {
  manaAtStart: number;
  enemyFreezeSkipTurnsAtStart: number;
}

export type EffectHandler = (
  state: BattleState,
  card: BattleCard,
  effect: BattleCardEffect,
  potionMult: number,
  combatTexts: CombatTextEvent[],
  context?: CardEffectResolutionContext,
) => BattleState;

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
