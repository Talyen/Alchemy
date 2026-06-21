// React hook wrapper around the pure shop-actions factory.
import { type RefObject } from "react";
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
  homesteadEffectsRef,
}: {
  run: RunStateController;
  talents: TalentStateController;
  homesteadEffectsRef: RefObject<HomesteadEffectManifest>;
}) {
  const { shopState, alchemistState, trinketShopState, equipmentShopState } = useRunSessionShopSlice();

  return createShopActions({
    run,
    talents,
    homesteadEffectsRef,
    shopState,
    alchemistState,
    trinketShopState,
    equipmentShopState,
    setShopState,
    setAlchemistState,
    setTrinketShopState,
    setEquipmentShopState,
  });
}
