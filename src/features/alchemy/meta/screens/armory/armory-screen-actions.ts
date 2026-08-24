import { canApplyCraftingCurrency, type CraftingCurrencyId, type GearInstance } from "@/lib/gear";
import { playUISound } from "@/lib/audio";
import type { ArmorySalvagePending } from "./armory-screen-types";

interface TargetingSetters {
  setSalvageMode: (value: boolean) => void;
  setActiveCurrencyId: (value: CraftingCurrencyId | null) => void;
  setSalvagePending?: (value: ArmorySalvagePending | null) => void;
}

export function resetArmoryTargeting({ setSalvageMode, setActiveCurrencyId, setSalvagePending }: TargetingSetters) {
  setSalvageMode(false);
  setActiveCurrencyId(null);
  setSalvagePending?.(null);
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
