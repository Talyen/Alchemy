import type { BattleCard, BattleCardEffect, BattleCardEffectKind } from "@/lib/game-data";
import type { BattleState, CombatTextEvent } from "../types";

export interface CardEffectResolutionContext {
  forgeTriggers?: Set<string>;
  manaAtStart: number;
  origin?: "played-card" | "triggered-card" | "companion";
  // Coordinated Strike applies to one Companion attack, including a dodged attempt.
  companionAttackBonus?: { amount: number };
  damageEffects?: Array<Extract<BattleCardEffect, { kind: "damage" }>>;
  // Dodged packets still count as attempts for encounter reactions, but they
  // resolve no damage for Unique repeats or Archery echoes.
  attackAttempted?: { value: boolean };
  onDamageDealt?: (amount: number) => void;
  damageMultiplier?: number;
  baseDamageBonus?: number;
  guaranteedCrit?: boolean;
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

/** Table keys determine the effect type; recursive effects belong to orchestration. */
export type EffectHandlers = {
  [K in Exclude<BattleCardEffectKind, "chance" | "repeat-over-turns">]: EffectHandler<K>;
};
