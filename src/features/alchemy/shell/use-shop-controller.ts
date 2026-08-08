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
  return useMemo(
    () => createShopActions({ talentEffects, homesteadEffects, rng }),
    [talentEffects, homesteadEffects, rng],
  );
}
import { useMemo } from "react";
