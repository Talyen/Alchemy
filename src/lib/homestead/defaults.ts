// Default homestead effect manifest — all zeros/false. Used as the base state
// before applying building/farm/research bonuses from computeHomesteadEffects.
import { createEmptyTalentEffectManifest } from "@/lib/game-data";
import type { HomesteadEffectManifest } from "./types";

export const defaultHomesteadEffects: HomesteadEffectManifest = {
  ...createEmptyTalentEffectManifest(),
  potionPotency: 0,
  herbFindBonus: 0,
  endRunFoodPerRoom: 0,
  endRunHerbsPerRoom: 0,
  endRunCrystalPerRoom: 0,
  gearAstralChanceBonus: 0,
  cardHealBonus: {},
};
