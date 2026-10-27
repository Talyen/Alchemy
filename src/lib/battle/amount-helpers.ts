import { HALF_DIVISOR, PERCENT_DENOMINATOR } from "../game-constants";
import type { BattleState } from "./types";
import { isMixedPotionCard, isStandardPotionCard, type BattleCard } from "@/lib/game-data";

export function cardPotionMultiplier(
  state: Pick<BattleState, "talentEffects"> & Partial<Pick<BattleState, "action">>,
  card: BattleCard,
): number {
  if (!card.consume || state.action?.repeatActive) return 1;
  const standard = isStandardPotionCard(card);
  const mixed = !standard && isMixedPotionCard(card);
  if (!standard && !mixed) return 1;
  return state.talentEffects.potionPotency + (mixed ? state.talentEffects.mixedPotionPotency : 0);
}

export function scaleByRoomMultiplier(state: Pick<BattleState, "roomScalingMultiplier">, value: number): number {
  return Math.round(value * state.roomScalingMultiplier);
}

export function applyPotionMultiplier(amount: number, potionMult: number): number {
  return potionMult === 1 ? amount : Math.round(amount * potionMult);
}

export function scalePercent(value: number, percent: number, denominator = PERCENT_DENOMINATOR): number {
  return Math.round((value * percent) / denominator);
}

export function applyPercentBonus(value: number, percent: number, denominator = PERCENT_DENOMINATOR): number {
  if (percent <= 0) return value;
  return Math.round(value * (1 + percent / denominator));
}

export function applyPercentReduction(value: number, percent: number, denominator = PERCENT_DENOMINATOR): number {
  if (percent <= 0) return value;
  return Math.max(0, Math.round(value * (1 - percent / denominator)));
}

export function halveRounded(value: number): number {
  return Math.round(value / HALF_DIVISOR);
}
