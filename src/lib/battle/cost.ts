// Read-only card-cost prediction for battle UI affordances.
// Depends on battle state and card damage metadata, and must mirror playBattleCardResolved.
// It never consumes free-card flags; the turn resolver owns stateful cost side effects.
import { cardHasDamageType } from "./turns";
import type { BattleState } from "./types";
import type { BattleCard } from "@/lib/game-data";
import { POTION_CARD_ID_FRAGMENT } from "../game-constants";

export function getEffectiveCost(state: BattleState, card: BattleCard): number {
  // This is intentionally side-effect free so hover/playable UI can call it repeatedly
  // without spending one-shot discounts or changing the battle state.
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
  // Mortar and Pestle trinket: first potion is free (mirrors playBattleCardResolved)
  if (!state.flags.firstPotionFreeUsed && state.trinketEffects.mortarPestleFreeFirstPotion && card.id.includes(POTION_CARD_ID_FRAGMENT)) {
    cost = 0;
  }
  return cost;
}
