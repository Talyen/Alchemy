import type { CharacterId } from "@/lib/game-data";
import type {
  CraftingCurrencyId,
  GearInstance,
  GearInventories,
  GearLoadouts,
  GearSlot,
  SalvageYield,
} from "@/lib/gear";

export interface ArmoryCursorPoint {
  x: number;
  y: number;
}

export interface ArmorySalvagePending {
  instance: GearInstance;
  yield: SalvageYield;
}

export interface ArmoryScreenProps {
  inventories: GearInventories;
  loadouts: GearLoadouts;
  finishedRunCharacters: CharacterId[];
  browseOnly: boolean;
  onOpenMenu: (rect?: DOMRect) => void;
  onEquip: (characterId: CharacterId, slot: GearSlot, instance: GearInstance) => void;
  onUnequip: (characterId: CharacterId, slot: GearSlot) => void;
  onSalvage: (instanceId: string, salvageYield: SalvageYield) => boolean;
  onSpawnDevGear?: (characterId: CharacterId) => void;
  craftingCurrencies?: Record<CraftingCurrencyId, number>;
  onApplyCurrency?: (currencyId: CraftingCurrencyId, instanceId: string) => boolean;
  rng: () => number;
}
