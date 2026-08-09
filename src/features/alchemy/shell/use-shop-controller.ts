import type { HomesteadEffectManifest } from "@/lib/homestead/types";
import type { TalentEffectManifest } from "@/lib/game-data";
import { createShopActions } from "@/features/alchemy/run-loop/shop/create-shop-actions";

export function useShopController({
  talentEffects,
  homesteadEffects,
}: {
  talentEffects: TalentEffectManifest;
  homesteadEffects: HomesteadEffectManifest;
}) {
  return useMemo(() => createShopActions({ talentEffects, homesteadEffects }), [talentEffects, homesteadEffects]);
}
import { useMemo } from "react";
