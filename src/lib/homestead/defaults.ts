import { defaultCompanionBondLevels } from "@/lib/game-data";
import { HOMESTEAD_BATTLE_NUMERIC_KEYS, type HomesteadEffectManifest } from "./types";
import { createNumericManifest } from "@/lib/manifest-utils";

export const defaultHomesteadEffects: HomesteadEffectManifest = {
  ...createNumericManifest(HOMESTEAD_BATTLE_NUMERIC_KEYS),
  companionBondLevels: { ...defaultCompanionBondLevels },
  cardHealBonus: {},
  herbFindBonus: 0,
  endRunStonePerRoom: 0,
  endRunFoodPerRoom: 0,
  endRunHerbsPerRoom: 0,
  endRunHidePerRoom: 0,
  endRunGemsPerRoom: 0,
  endRunIronPerRoom: 0,
  endRunWoodPerRoom: 0,
  endRunGoldPerRoom: 0,
  endRunWishPerRoom: 0,
  removeCardDiscount: 0,
  mixPotionDiscount: 0,
  gearAstralChanceBonus: 0,
};
