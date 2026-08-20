import type { BattleCard, BattleCardEffect } from "@/lib/game-data";
import type { BattleState, CombatTextEvent } from "../types";

export interface CardEffectResolutionContext {
  manaAtStart: number;
  enemyFreezeSkipTurnsAtStart: number;
}

/** Unified handler signature — each apply module narrows `effect` by kind internally. */
export type EffectHandler = (
  state: BattleState,
  card: BattleCard,
  effect: BattleCardEffect,
  potionMult: number,
  combatTexts: CombatTextEvent[],
  context?: CardEffectResolutionContext,
) => BattleState;
