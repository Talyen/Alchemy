/**
 * Provides a read-only prediction of a card's effective mana cost.
 * Depends on: card-play.ts, types.ts, @/lib/game-data.
 * Depended on by: battle UI components.
 */
import { computeEffectiveCost } from "./card-play";
import type { BattleState } from "./types";
import type { BattleCard } from "@/lib/game-data";

export function getEffectiveCost(
  state: Pick<BattleState, "flags" | "talentEffects" | "boonEffects">,
  card: BattleCard,
): number {
  return computeEffectiveCost(state, card).effectiveCost;
}
