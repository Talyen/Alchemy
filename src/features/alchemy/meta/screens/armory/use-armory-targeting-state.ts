import { useCallback, useState } from "react";
import type { CharacterId } from "@/lib/game-data";
import type { CraftingCurrencyId, GearInstance } from "@/lib/gear";
import type { ArmorySalvagePending } from "./armory-screen-types";
import { useArmoryResetEffects } from "./use-armory-reset-effects";
import { useArmoryTargetingEvents } from "./use-armory-targeting-events";

export function useArmoryTargetingState({
  editable,
  craftingCurrencies,
  characterId,
  inventoryById,
}: {
  editable: boolean;
  craftingCurrencies: Record<CraftingCurrencyId, number>;
  characterId: CharacterId;
  inventoryById: Map<string, GearInstance>;
}) {
  const [salvageMode, setSalvageMode] = useState(false);
  const [activeCurrencyId, setActiveCurrencyId] = useState<CraftingCurrencyId | null>(null);
  const [salvagePending, setSalvagePending] = useState<ArmorySalvagePending | null>(null);

  const clearTargeting = useCallback(() => {
    setSalvageMode(false);
    setActiveCurrencyId(null);
    setSalvagePending(null);
  }, []);

  useArmoryResetEffects({
    editable,
    craftingCurrencies,
    activeCurrencyId,
    characterId,
    inventoryById,
    salvagePending,
    salvageMode,
    setSalvageMode,
    setSalvagePending,
    setActiveCurrencyId,
  });

  useArmoryTargetingEvents({
    salvageMode,
    activeCurrencyId,
    salvageTarget: salvagePending?.instance ?? null,
    clearTargeting,
  });

  return {
    salvageMode,
    setSalvageMode,
    activeCurrencyId,
    setActiveCurrencyId,
    salvagePending,
    setSalvagePending,
    clearTargeting,
  };
}
