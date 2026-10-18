import {
  cardById,
  createEffectDescription,
  withCardDescription,
  type BattleCard,
  type BattleCardEffect,
} from "@/lib/game-data";
import { BattleCardSchema } from "@/lib/validation/save-schemas/battle-card-schemas";
import { hydrateCard } from "@/lib/game-data/cards/hydrate-card";

export function describedCard(effects: BattleCardEffect[], overrides: Partial<BattleCard> = {}): BattleCard {
  return withCardDescription({ ...cardById.slash!, ...overrides, effects }, createEffectDescription(effects));
}
export function potion(effects: BattleCardEffect[], overrides: Partial<BattleCard> = {}): BattleCard {
  return describedCard(effects, { ...cardById["health-potion"]!, ...overrides });
}
export function chance(
  successEffects: BattleCardEffect[],
  failureEffects: BattleCardEffect[],
  probability = 0.5,
): Extract<BattleCardEffect, { kind: "chance" }> {
  return { kind: "chance", probability, successEffects, failureEffects };
}
export function repeated(
  effects: BattleCardEffect[],
  remainingTurns = 2,
): Extract<BattleCardEffect, { kind: "repeat-over-turns" }> {
  return { kind: "repeat-over-turns", remainingTurns, effects };
}
export function roundTrip(card: BattleCard): BattleCard {
  return hydrateCard(BattleCardSchema.parse(JSON.parse(JSON.stringify(card))));
}
