import { characters, type CharacterId } from "@/lib/game-data";
import { MAX_HEALTH_PER_TALENT_POINT } from "@/lib/game-constants";
import { defaultHomesteadEffects } from "@/lib/homestead/defaults";
import type { HomesteadEffectManifest } from "@/lib/homestead/types";
import { defaultGearEffects, type GearEffectManifest } from "@/lib/gear/gear-effect-manifest";
import { createSeededRng } from "@/lib/utils";
import { buildTypicalGearEffects } from "./gear-preset";
import { buildTypicalHomesteadEffects } from "./homestead-preset";
import { countUnlockedCombatTalents } from "./talent-preset";
import type { TalentPreset } from "./types";

export type BalanceLoadoutMode = "bare" | "typical";

export const TIER_GOLD: Record<TalentPreset, number> = {
  early: 0,
  mid: 40,
  late: 80,
};

const LATE_CORE_TRINKETS = ["tattered-pages", "groves-favor"] as const;
const MID_CORE_TRINKETS = ["groves-favor"] as const;
const TYPICAL_GEAR_RNG_SALT = 17_411;

export interface SimLoadout {
  mode: BalanceLoadoutMode;
  gold: number;
  homesteadCombat: HomesteadEffectManifest;
  gearEffects: GearEffectManifest;
  coreTrinketIds: string[];
  talentPointHealth: number;
}

function talentPointHealthForCharacter(characterId: CharacterId, preset: TalentPreset): number {
  return countUnlockedCombatTalents(characters[characterId].keywords, preset) * MAX_HEALTH_PER_TALENT_POINT;
}

export function resolveSimLoadout(options: {
  preset: TalentPreset;
  characterId: CharacterId;
  mode: BalanceLoadoutMode;
  startGold?: number;
  seed?: number;
}): SimLoadout {
  const gold = TIER_GOLD[options.preset] + (options.startGold ?? 0);
  const talentPointHealth = talentPointHealthForCharacter(options.characterId, options.preset);

  if (options.mode === "bare") {
    return {
      mode: "bare",
      gold,
      homesteadCombat: {
        ...defaultHomesteadEffects,
        companionBondLevels: { ...defaultHomesteadEffects.companionBondLevels },
        cardHealBonus: { ...defaultHomesteadEffects.cardHealBonus },
      },
      gearEffects: { ...defaultGearEffects },
      coreTrinketIds: [],
      talentPointHealth,
    };
  }

  const homesteadCombat = buildTypicalHomesteadEffects(options.preset);
  const gearRng = createSeededRng((options.seed ?? 1) + TYPICAL_GEAR_RNG_SALT);
  const gearEffects =
    options.preset === "early"
      ? { ...defaultGearEffects }
      : buildTypicalGearEffects(options.characterId, options.preset, gearRng, homesteadCombat.gearAstralChanceBonus);

  return {
    mode: "typical",
    gold,
    homesteadCombat,
    gearEffects,
    coreTrinketIds:
      options.preset === "late" ? [...LATE_CORE_TRINKETS] : options.preset === "mid" ? [...MID_CORE_TRINKETS] : [],
    talentPointHealth,
  };
}
