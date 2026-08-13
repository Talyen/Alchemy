import type { CharacterId } from "@/lib/game-data";
import type { CraftingCurrencyId, GearInstance, GearInventories, GearLoadouts, GearSlot } from "@/lib/gear";

export interface ArmoryCursorPoint {
  x: number;
  y: number;
}

export interface ArmoryScreenProps {
  inventories: GearInventories;
  loadouts: GearLoadouts;
  finishedRunCharacters: CharacterId[];
  browseOnly: boolean;
  onOpenMenu: (rect?: DOMRect) => void;
  onEquip: (characterId: CharacterId, slot: GearSlot, instance: GearInstance) => void;
  onUnequip: (characterId: CharacterId, slot: GearSlot) => void;
  onSalvage: (instanceId: string) => boolean;
  onSpawnDevGear?: (characterId: CharacterId) => void;
  craftingCurrencies?: Record<CraftingCurrencyId, number>;
  onApplyCurrency?: (currencyId: CraftingCurrencyId, instanceId: string) => boolean;
}
