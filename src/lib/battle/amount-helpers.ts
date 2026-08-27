/**
 * Shared amount helpers for battle magnitudes.
 * Battle rounds to nearest integer (Math.round) per REFERENCE § Battle Implementation Rules.
 */

export function applyPotionMultiplier(amount: number, potionMult: number): number {
  return potionMult === 1 ? amount : Math.round(amount * potionMult);
}

export function scaleBlockBonus(block: number, percent: number, denominator = 100): number {
  return Math.round((block * percent) / denominator);
}
