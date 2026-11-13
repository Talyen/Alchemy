import type { CraftingCurrencyId, GearInstance } from "@/lib/gear";

export interface CraftingResult {
  before: GearInstance;
  currencyId: CraftingCurrencyId;
}
