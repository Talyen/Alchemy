// React hook wrapper around the pure shop-actions factory.
import type { RunStateController, TalentStateController } from "@/features/alchemy/shared/stores/run-session-facade";
import { useRunSessionShopSlice } from "@/features/alchemy/shared/stores/run-session-facade";
import {
  setShopState,
  setAlchemistState,
  setTrinketShopState,
  setEquipmentShopState,
} from "@/features/alchemy/shared/stores/run-session-facade";
import type { HomesteadEffectManifest } from "@/lib/homestead/types";
import { createShopActions } from "@/features/alchemy/run-loop/shop/create-shop-actions";

export function useShopController({
  run,
  talents,
  homesteadEffects,
  rng,
}: {
  run: RunStateController;
  talents: TalentStateController;
  homesteadEffects: HomesteadEffectManifest;
  rng: () => number;
}) {
  const { shopState, alchemistState, trinketShopState, equipmentShopState } = useRunSessionShopSlice();

  return createShopActions({
    run,
    talents,
    homesteadEffects,
    shopState,
    alchemistState,
    trinketShopState,
    equipmentShopState,
    rng,
    setShopState,
    setAlchemistState,
    setTrinketShopState,
    setEquipmentShopState,
  });
}
