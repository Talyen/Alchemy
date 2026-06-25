import {
  canApplyCraftingCurrency,
  findGearInventoryOwner,
  type CraftingCurrencyId,
  type GearInstance,
  type GearLoadouts,
  type GearSlot,
  type InventoryPlacement,
  type PackedInventoryItem,
} from "@/lib/gear";
import { characters, isCharacterUnlocked, type CharacterId } from "@/lib/game-data";
import { playUISound } from "@/lib/audio";
import type { TransferMenuState } from "./armory-transfer-menu";
import { resolveEquipSwap } from "./resolve-equip-swap";
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
export function blurActiveArmoryElement() {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
}

export function buildTransferMenuState({
  inventories,
  instance,
  anchor,
  finishedRunCharacters,
}: {
  inventories: Record<CharacterId, GearInstance[]>;
  instance: GearInstance;
  anchor: { x: number; y: number };
  finishedRunCharacters: CharacterId[];
}): TransferMenuState | null {
  const owner = findGearInventoryOwner(inventories, instance.instanceId);
  if (!owner) return null;
  const recipients = (Object.keys(characters) as CharacterId[])
    .filter((id) => id !== owner)
    .filter((id) => isCharacterUnlocked(id, finishedRunCharacters));
  if (recipients.length === 0) return null;
  return {
    instanceId: instance.instanceId,
    sourceCharacterId: owner,
    anchor,
  };
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

export function equipWithArmorySwap({
  targetCharacterId,
  slot,
  instance,
  options,
  loadouts,
  inventoryById,
  packedItems,
  onEquip,
}: {
  targetCharacterId: CharacterId;
  slot: GearSlot;
  instance: GearInstance;
  options: { vacatedPlacement?: InventoryPlacement } | undefined;
  loadouts: GearLoadouts;
  inventoryById: Map<string, GearInstance>;
  packedItems: PackedInventoryItem[];
  onEquip: (
    characterId: CharacterId,
    slot: GearSlot,
    instance: GearInstance,
    options?: { vacatedPlacement?: InventoryPlacement; swapDisplaced?: boolean },
  ) => void;
}) {
  const vacatedPlacement = options?.vacatedPlacement;
  if (!vacatedPlacement) {
    onEquip(targetCharacterId, slot, instance);
    return;
  }

  const { canSwap } = resolveEquipSwap({
    loadout: loadouts[targetCharacterId],
    slot,
    instance,
    vacatedPlacement,
    inventoryById,
    packedItems,
  });

  onEquip(targetCharacterId, slot, instance, { vacatedPlacement, swapDisplaced: canSwap });
}
