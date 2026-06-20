import {
  CRAFTING_CURRENCY_IDS,
  createEmptyCurrencyBoardPositionsByCharacter,
  type CraftingCurrencyBoardPositions,
  type CraftingCurrencyBoardPositionsByCharacter,
  type CraftingCurrencyId,
} from "./crafting";
import { INVENTORY_COLS } from "./constants";
import { footprintForInstance } from "./footprints";
import {
  GEAR_CHARACTER_IDS,
  createEmptyGearBoardPositionsByCharacter,
  type GearBoardPositions,
  type GearBoardPositionsByCharacter,
  type GearInventories,
  type GearInstance,
} from "./types";

function sanitizeCurrencyBoardPositions(
  boardPositions: CraftingCurrencyBoardPositions,
  currencies: Record<CraftingCurrencyId, number>,
): CraftingCurrencyBoardPositions {
  const next: CraftingCurrencyBoardPositions = {};
  for (const id of CRAFTING_CURRENCY_IDS) {
    if (currencies[id] <= 0) continue;
    const position = boardPositions[id];
    if (!position) continue;
    if (position.col < 1 || position.row < 1 || position.col > INVENTORY_COLS) continue;
    next[id] = position;
  }
  return next;
}

export function sanitizeGearBoardPositions(
  boardPositions: GearBoardPositions,
  inventory: GearInstance[],
): GearBoardPositions {
  const inventoryIds = new Set(inventory.map((item) => item.instanceId));
  const next: GearBoardPositions = {};
  for (const [instanceId, position] of Object.entries(boardPositions)) {
    if (!inventoryIds.has(instanceId)) continue;
    const item = inventory.find((entry) => entry.instanceId === instanceId);
    if (!item) continue;
    const footprint = footprintForInstance(item);
    if (!footprint) continue;
    if (position.col < 1 || position.row < 1 || position.col + footprint.w - 1 > INVENTORY_COLS) continue;
    next[instanceId] = position;
  }
  return next;
}

export function sanitizeGearBoardPositionsByCharacter(
  boardPositionsByCharacter: GearBoardPositionsByCharacter,
  inventories: GearInventories,
): GearBoardPositionsByCharacter {
  const next = createEmptyGearBoardPositionsByCharacter();
  for (const characterId of GEAR_CHARACTER_IDS) {
    next[characterId] = sanitizeGearBoardPositions(boardPositionsByCharacter[characterId], inventories[characterId]);
  }
  return next;
}

export function sanitizeCurrencyBoardPositionsByCharacter(
  boardPositionsByCharacter: CraftingCurrencyBoardPositionsByCharacter,
  currencies: Record<CraftingCurrencyId, number>,
): CraftingCurrencyBoardPositionsByCharacter {
  const next = createEmptyCurrencyBoardPositionsByCharacter();
  for (const characterId of GEAR_CHARACTER_IDS) {
    next[characterId] = sanitizeCurrencyBoardPositions(boardPositionsByCharacter[characterId], currencies);
  }
  return next;
}
