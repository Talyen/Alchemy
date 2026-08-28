export function applyPotionMultiplier(amount: number, potionMult: number): number {
  return potionMult === 1 ? amount : Math.round(amount * potionMult);
}

export function scalePercent(value: number, percent: number, denominator = 100): number {
  return Math.round((value * percent) / denominator);
}

export function scalePerMana(maxMana: number, value: number, unit: "percent" | "half"): number {
  const divisor = unit === "percent" ? 100 : 2;
  return Math.round((maxMana * value) / divisor);
}
