import { defaultCompanionBondLevels } from "@/lib/game-data";
import { HOMESTEAD_BATTLE_NUMERIC_KEYS, type HomesteadEffectManifest } from "./types";
import { createNumericManifest } from "@/lib/manifest-utils";

export const defaultHomesteadEffects: HomesteadEffectManifest = {
  ...createNumericManifest(HOMESTEAD_BATTLE_NUMERIC_KEYS),
  companionBondLevels: { ...defaultCompanionBondLevels },
  cardHealBonus: {},
  herbFindBonus: 0,
  woodFindBonus: 0,
  stoneFindBonus: 0,
  ironFindBonus: 0,
  foodFindBonus: 0,
  hideFindBonus: 0,
  removeCardDiscount: 0,
  mixPotionDiscount: 0,
  gearAstralChanceBonus: 0,
};
