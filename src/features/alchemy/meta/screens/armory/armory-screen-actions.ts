import {
  canApplyCraftingCurrency,
  gearDefinitions,
  type CraftingCurrencyId,
  type GearInstance,
  type GearSlot,
} from "@/lib/gear";
import { playUISound } from "@/lib/audio";
import type { ArmorySalvagePending } from "./armory-screen-types";

interface TargetingSetters {
  setSalvageMode: (value: boolean) => void;
  setActiveCurrencyId: (value: CraftingCurrencyId | null) => void;
  setSalvagePending?: (value: ArmorySalvagePending | null) => void;
}

export function itemsMatchingSlot(inventory: GearInstance[], slot: GearSlot): GearInstance[] {
  return inventory.filter((item) => gearDefinitions[item.definitionId]?.compatibleSlots.includes(slot) ?? false);
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
  onApplyCurrency,
  clearCurrency,
}: {
  editable: boolean;
  activeCurrencyId: CraftingCurrencyId | null;
  instance: GearInstance;
  onApplyCurrency: (currencyId: CraftingCurrencyId, instanceId: string) => boolean;
  clearCurrency: () => void;
}): boolean {
  if (!editable || !activeCurrencyId) return false;
  if (!canApplyCraftingCurrency(activeCurrencyId, instance)) {
    playUISound("error");
    return false;
  }
  const ok = onApplyCurrency(activeCurrencyId, instance.instanceId);
  if (!ok) {
    playUISound("error");
    return false;
  }
  playUISound("talentUnlock");
  clearCurrency();
  return true;
}
