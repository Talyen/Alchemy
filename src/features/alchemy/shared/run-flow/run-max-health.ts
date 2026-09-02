import { computeStartingMaxHealth, type TalentXP } from "@/lib/game-data";

export function computeRunMaxHealth(
  talentXP: TalentXP,
  gearMaxHealthBonus: number,
  homesteadMaxHealthBonus: number,
): number {
  return computeStartingMaxHealth(talentXP) + gearMaxHealthBonus + homesteadMaxHealthBonus;
}
