import { useEffect } from "react";
import type { CharacterId } from "@/lib/game-data";
import type { CraftingCurrencyId, GearInstance } from "@/lib/gear";
import type { ArmoryCursorPoint, ArmorySalvagePending } from "./armory-screen-types";

export function useArmoryResetEffects({
  editable,
  craftingCurrencies,
  activeCurrencyId,
  characterId,
  inventoryById,
  salvagePending,
  setCursorPoint,
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
  setCursorPoint: React.Dispatch<React.SetStateAction<ArmoryCursorPoint | null>>;
  setSalvageMode: React.Dispatch<React.SetStateAction<boolean>>;
  setSalvagePending: React.Dispatch<React.SetStateAction<ArmorySalvagePending | null>>;
  setActiveCurrencyId: React.Dispatch<React.SetStateAction<CraftingCurrencyId | null>>;
}) {
  useEffect(() => {
    if (editable) return;
    const timer = setTimeout(() => {
      setCursorPoint(null);
      setSalvageMode(false);
      setSalvagePending(null);
      setActiveCurrencyId(null);
    }, 0);
    return () => clearTimeout(timer);
  }, [editable, setCursorPoint, setSalvageMode, setSalvagePending, setActiveCurrencyId]);

  useEffect(() => {
    if (!activeCurrencyId || craftingCurrencies[activeCurrencyId] > 0) return;
    const timer = setTimeout(() => {
      setCursorPoint(null);
      setActiveCurrencyId(null);
    }, 0);
    return () => clearTimeout(timer);
  }, [activeCurrencyId, craftingCurrencies, setCursorPoint, setActiveCurrencyId]);

  useEffect(() => {
    if (!salvagePending || inventoryById.has(salvagePending.instance.instanceId)) return;
    const timer = setTimeout(() => setSalvagePending(null), 0);
    return () => clearTimeout(timer);
  }, [salvagePending, inventoryById, setSalvagePending]);

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
