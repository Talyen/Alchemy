import { useEffect } from "react";
import type { CharacterId } from "@/lib/game-data";
import type { CraftingCurrencyId, GearInstance } from "@/lib/gear";
import type { ArmorySalvagePending } from "./armory-screen-types";

export function useArmoryResetEffects({
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
}: {
  editable: boolean;
  craftingCurrencies: Record<CraftingCurrencyId, number>;
  activeCurrencyId: CraftingCurrencyId | null;
  characterId: CharacterId;
  inventoryById: Map<string, GearInstance>;
  salvagePending: ArmorySalvagePending | null;
  salvageMode: boolean;
  setSalvageMode: React.Dispatch<React.SetStateAction<boolean>>;
  setSalvagePending: React.Dispatch<React.SetStateAction<ArmorySalvagePending | null>>;
  setActiveCurrencyId: React.Dispatch<React.SetStateAction<CraftingCurrencyId | null>>;
}) {
  useEffect(() => {
    if (!editable) {
      if (salvageMode) setSalvageMode(false);
      if (salvagePending !== null) setSalvagePending(null);
      if (activeCurrencyId !== null) setActiveCurrencyId(null);
      return;
    }
    if (activeCurrencyId !== null && craftingCurrencies[activeCurrencyId] <= 0) {
      setActiveCurrencyId(null);
    }
    if (salvagePending !== null && !inventoryById.has(salvagePending.instance.instanceId)) {
      setSalvagePending(null);
    }
  }, [
    editable,
    salvageMode,
    salvagePending,
    activeCurrencyId,
    craftingCurrencies,
    inventoryById,
    setSalvageMode,
    setSalvagePending,
    setActiveCurrencyId,
  ]);

  useEffect(() => {
    if (!editable && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, [editable]);

  useEffect(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, [characterId]);
}
