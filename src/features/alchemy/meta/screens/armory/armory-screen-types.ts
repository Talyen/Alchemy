import type { CharacterId } from "@/lib/game-data";
import type {
  CraftingCurrencyId,
  GearInstance,
  GearInventories,
  GearLoadouts,
  GearSlot,
  EquippedTrinkets,
  SalvageYield,
} from "@/lib/gear";

import type { GearCombatRestrictions } from "../../../shared/stores/gear-store";

import type { CraftingResult } from "./crafting-result";

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
  onSetProtected: (instanceId: string, protectedItem: boolean) => boolean;
  onSalvage: (instance: GearInstance) => void;
  onApplyCurrency: (instance: GearInstance) => void;
}

export interface ArmoryScreenProps {
  inventories: GearInventories;
  loadouts: GearLoadouts;
  ownedTrinketIds: string[];
  equippedTrinkets: EquippedTrinkets;
  finishedRunCharacters: CharacterId[];
  combatRestrictions: GearCombatRestrictions;
  onEquip: (characterId: CharacterId, slot: GearSlot, instance: GearInstance) => void;
  onUnequip: (characterId: CharacterId, slot: GearSlot) => void;
  onEquipTrinket: (characterId: CharacterId, trinketId: string) => void;
  onUnequipTrinket: (characterId: CharacterId) => void;
  onSetProtected: (instanceId: string, protectedItem: boolean) => boolean;
  onSalvage: (instanceId: string, salvageYield: SalvageYield) => boolean;
  onSpawnDevGear?: (characterId: CharacterId) => void;
  craftingCurrencies?: Record<CraftingCurrencyId, number>;
  onApplyCurrency?: (currencyId: CraftingCurrencyId, instanceId: string) => boolean;
  onBack?: (() => void) | undefined;
  onMenu?: ((rect: DOMRect) => void) | undefined;
}
