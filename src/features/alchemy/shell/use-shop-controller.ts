import {
  setShopState,
  setAlchemistState,
  setTrinketShopState,
  setEquipmentShopState,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import type { HomesteadEffectManifest } from "@/lib/homestead/types";
import type { TalentEffectManifest } from "@/lib/game-data";
import { createShopActions } from "@/features/alchemy/run-loop/shop/create-shop-actions";

export function useShopController({
  talentEffects,
  homesteadEffects,
  rng,
}: {
  talentEffects: TalentEffectManifest;
  homesteadEffects: HomesteadEffectManifest;
  rng: () => number;
}) {
  return createShopActions({
    talentEffects,
    homesteadEffects,
    rng,
    setShopState,
    setAlchemistState,
    setTrinketShopState,
    setEquipmentShopState,
  });
}
