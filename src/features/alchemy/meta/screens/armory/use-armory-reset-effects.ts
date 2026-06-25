import { useEffect } from "react";
import type { CharacterId } from "@/lib/game-data";
import type { CraftingCurrencyId, GearInstance } from "@/lib/gear";
import type { ArmoryCursorPoint } from "./armory-screen-types";

export function useArmoryResetEffects({
  editable,
  craftingCurrencies,
  activeCurrencyId,
  characterId,
  inventoryById,
  salvageTarget,
  setCursorPoint,
  setSalvageMode,
  setSalvageTarget,
  setActiveCurrencyId,
}: {
  editable: boolean;
  craftingCurrencies: Record<CraftingCurrencyId, number>;
  activeCurrencyId: CraftingCurrencyId | null;
  characterId: CharacterId;
  inventoryById: Map<string, GearInstance>;
  salvageTarget: GearInstance | null;
  setCursorPoint: React.Dispatch<React.SetStateAction<ArmoryCursorPoint | null>>;
  setSalvageMode: React.Dispatch<React.SetStateAction<boolean>>;
  setSalvageTarget: React.Dispatch<React.SetStateAction<GearInstance | null>>;
  setActiveCurrencyId: React.Dispatch<React.SetStateAction<CraftingCurrencyId | null>>;
}) {
  useEffect(() => {
    if (editable) return;
    const timer = setTimeout(() => {
      setCursorPoint(null);
      setSalvageMode(false);
      setSalvageTarget(null);
      setActiveCurrencyId(null);
    }, 0);
    return () => clearTimeout(timer);
  }, [editable, setCursorPoint, setSalvageMode, setSalvageTarget, setActiveCurrencyId]);

  useEffect(() => {
    if (!activeCurrencyId || craftingCurrencies[activeCurrencyId] > 0) return;
    const timer = setTimeout(() => {
      setCursorPoint(null);
      setActiveCurrencyId(null);
    }, 0);
    return () => clearTimeout(timer);
  }, [activeCurrencyId, craftingCurrencies, setCursorPoint, setActiveCurrencyId]);

  useEffect(() => {
    if (!salvageTarget || inventoryById.has(salvageTarget.instanceId)) return;
    const timer = setTimeout(() => setSalvageTarget(null), 0);
    return () => clearTimeout(timer);
  }, [salvageTarget, inventoryById, setSalvageTarget]);

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
