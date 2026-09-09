import type { CraftingCurrencyId, GearInstance, SalvageYield } from "@/lib/gear";

import type { CraftingResult } from "./crafting-result";
import type { ArmoryController } from "./use-armory-controller";

export interface ArmorySalvagePending {
  instance: GearInstance;
  yield: SalvageYield;
}

export interface ArmoryTargeting {
  editable: boolean;
  salvageMode: boolean;
  activeCurrencyId: CraftingCurrencyId | null;
  craftingResult: CraftingResult | null;
}

export interface ArmoryItemActions {
  onEquipGear: (instance: GearInstance) => void;
  onEquipTrinket: (trinketId: string) => void;
  onSalvage: (instance: GearInstance) => void;
  onApplyCurrency: (instance: GearInstance) => void;
  onCombatLockedAttempt: () => void;
}

export interface ArmoryScreenProps extends Omit<ArmoryController, "craftingCurrencies" | "onApplyCurrency"> {
  craftingCurrencies?: Record<CraftingCurrencyId, number>;
  onApplyCurrency?: (currencyId: CraftingCurrencyId, instanceId: string) => boolean;
  onBack?: (() => void) | undefined;
  onMenu?: ((rect: DOMRect) => void) | undefined;
}
