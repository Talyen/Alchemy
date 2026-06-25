import type { CraftingCurrencyBoardPositionsByCharacter, CraftingCurrencyId } from "./crafting";
import type { GearBoardPositionsByCharacter, GearInventories, GearLoadouts } from "./types";

export interface BoardSourceState {
  inventories: GearInventories;
  loadouts: GearLoadouts;
  craftingCurrencies: Record<CraftingCurrencyId, number>;
  boardPositionsByCharacter: GearBoardPositionsByCharacter;
  currencyBoardPositionsByCharacter: CraftingCurrencyBoardPositionsByCharacter;
}
