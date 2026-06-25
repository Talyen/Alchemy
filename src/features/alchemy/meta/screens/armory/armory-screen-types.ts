import type { CharacterId } from "@/lib/game-data";
import type {
  BoardItemRef,
  CraftingCurrencyBoardPositionsByCharacter,
  CraftingCurrencyId,
  GearBoardPositionsByCharacter,
  GearInstance,
  GearInventories,
  GearLoadouts,
  GearSlot,
  InventoryPlacement,
} from "@/lib/gear";

export interface ArmoryCursorPoint {
  x: number;
  y: number;
}

export interface ArmoryScreenProps {
  inventories: GearInventories;
  loadouts: GearLoadouts;
  gearBoardPositionsByCharacter?: GearBoardPositionsByCharacter;
  currencyBoardPositionsByCharacter?: CraftingCurrencyBoardPositionsByCharacter;
  finishedRunCharacters: CharacterId[];
  browseOnly: boolean;
  onOpenMenu: (rect?: DOMRect) => void;
  onEquip: (
    characterId: CharacterId,
    slot: GearSlot,
    instance: GearInstance,
    options?: { vacatedPlacement?: InventoryPlacement; swapDisplaced?: boolean },
  ) => void;
  onUnequip: (characterId: CharacterId, slot: GearSlot) => void;
  onSalvage: (instanceId: string) => boolean;
  onSpawnDevGear?: (characterId: CharacterId) => void;
  craftingCurrencies?: Record<CraftingCurrencyId, number>;
  onApplyCurrency?: (currencyId: CraftingCurrencyId, instanceId: string) => boolean;
  onTransferGear?: (instanceId: string, targetCharacterId: CharacterId) => boolean;
  onMoveBoardItem?: (characterId: CharacterId, item: BoardItemRef, col: number, row: number) => void;
  onSortBoard?: (characterId: CharacterId) => void;
}
