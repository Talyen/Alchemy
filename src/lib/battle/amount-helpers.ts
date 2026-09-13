export function applyPotionMultiplier(amount: number, potionMult: number): number {
  return potionMult === 1 ? amount : Math.round(amount * potionMult);
}

export function scalePercent(value: number, percent: number, denominator = 100): number {
  return Math.round((value * percent) / denominator);
}

export function applyPercentBonus(value: number, percent: number, denominator = 100): number {
  if (percent <= 0) return value;
  return Math.round(value * (1 + percent / denominator));
}

export function applyPercentReduction(value: number, percent: number, denominator = 100): number {
  if (percent <= 0) return value;
  return Math.max(0, Math.round(value * (1 - percent / denominator)));
}

export function scalePerMana(maxMana: number, value: number, unit: "percent" | "half"): number {
  const divisor = unit === "percent" ? 100 : 2;
  return Math.round((maxMana * value) / divisor);
}

export function halveRounded(value: number): number {
  return Math.round(value / 2);
}
