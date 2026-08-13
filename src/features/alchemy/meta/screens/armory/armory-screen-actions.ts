import { canApplyCraftingCurrency, type CraftingCurrencyId, type GearInstance } from "@/lib/gear";
import { playUISound } from "@/lib/audio";
import type { ArmoryCursorPoint } from "./armory-screen-types";

interface TargetingSetters {
  setSalvageMode: (value: boolean) => void;
  setActiveCurrencyId: (value: CraftingCurrencyId | null) => void;
  setCursorPoint: (value: ArmoryCursorPoint | null) => void;
  setSalvageTarget?: (value: GearInstance | null) => void;
}

export function resetArmoryTargeting({
  setSalvageMode,
  setActiveCurrencyId,
  setCursorPoint,
  setSalvageTarget,
}: TargetingSetters) {
  setSalvageMode(false);
  setActiveCurrencyId(null);
  setCursorPoint(null);
  setSalvageTarget?.(null);
}

export function applyCurrencyToGear({
  editable,
  activeCurrencyId,
  instance,
  craftingCurrencies,
  onApplyCurrency,
  clearCurrency,
}: {
  editable: boolean;
  activeCurrencyId: CraftingCurrencyId | null;
  instance: GearInstance;
  craftingCurrencies: Record<CraftingCurrencyId, number>;
  onApplyCurrency: (currencyId: CraftingCurrencyId, instanceId: string) => boolean;
  clearCurrency: () => void;
}) {
  if (!editable || !activeCurrencyId) return;
  if (!canApplyCraftingCurrency(activeCurrencyId, instance)) {
    playUISound("error");
    return;
  }
  const ok = onApplyCurrency(activeCurrencyId, instance.instanceId);
  if (!ok) {
    playUISound("error");
    return;
  }
  playUISound("talentUnlock");
  if (craftingCurrencies[activeCurrencyId] <= 1) {
    clearCurrency();
  }
}
