// Read-only card-cost prediction for battle UI affordances.
// Delegates to computeEffectiveCost, discarding the consumedFlags so callers
// (hover/playable UI) can poll freely without spending one-shot discounts.
import { computeEffectiveCost } from "./card-play";
import type { BattleState } from "./types";
import type { BattleCard } from "@/lib/game-data";

export function getEffectiveCost(state: BattleState, card: BattleCard): number {
  return computeEffectiveCost(state, card).effectiveCost;
}
