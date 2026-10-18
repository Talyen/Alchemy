import { HALF_DIVISOR, PERCENT_DENOMINATOR } from "../game-constants";
import type { BattleState } from "./types";

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
