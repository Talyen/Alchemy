import { cardHasDamageType } from "./turns";
import type { BattleState } from "./types";
import type { BattleCard } from "@/lib/game-data";

export function getEffectiveCost(state: BattleState, card: BattleCard): number {
  let cost = card.cost;
  if (state.flags.nextCardCostReduction > 0) {
    cost = Math.max(0, cost - state.flags.nextCardCostReduction);
  }
  if (!state.flags.firstPhysicalCardFreeUsed && state.talentEffects.firstPhysicalCardFree && cardHasDamageType(card, "physical")) {
    cost = 0;
  }
  if (!state.flags.firstHolyCardFreeUsed && state.talentEffects.firstHolyCardFree && cardHasDamageType(card, "holy")) {
    cost = 0;
  }
  if (!state.flags.firstPoisonCardFreeUsed && state.talentEffects.firstPoisonCardFree && cardHasDamageType(card, "poison")) {
    cost = 0;
  }
  if (!state.flags.firstBleedCardFreeUsed && state.talentEffects.firstBleedCardFree && cardHasDamageType(card, "bleed")) {
    cost = 0;
  }
  return cost;
}
