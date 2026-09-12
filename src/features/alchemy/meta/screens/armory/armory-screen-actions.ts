import { playUISound } from "@/lib/audio";
import {
  canApplyCraftingCurrency,
  gearDefinitions,
  type CraftingCurrencyId,
  type GearInstance,
  type GearSlot,
} from "@/lib/gear";
export function itemsMatchingSlot(inventory: GearInstance[], slot: GearSlot): GearInstance[] {
  return inventory.filter((item) => gearDefinitions[item.definitionId]?.compatibleSlots.includes(slot) ?? false);
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
