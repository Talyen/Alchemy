import type { EncounterRewardTraitId } from "@/lib/content-systems/encounter-traits";
import type { BattleCard, TrinketEntry } from "@/lib/game-data";
import type { GearInstance } from "@/lib/gear";

export type ShopKind = "merchant" | "alchemist" | "trinket" | "equipment";

export type ShopRefreshModifiers = readonly EncounterRewardTraitId[];

export interface MerchantShopCommands {
  buyCard: (card: BattleCard, slotKey: string) => boolean;
  removeCard: (index: number) => boolean;
  refresh: () => boolean;
  getCardBuyPrice: (card: BattleCard) => number;
  getRemoveCardPrice: () => number;
  getRefreshPrice: () => number;
}

export interface AlchemistShopCommands {
  buyPotion: (card: BattleCard, slotKey: string) => boolean;
  mixPotions: (indexA: number, indexB: number) => BattleCard | null;
  strengthenPotion: (index: number) => BattleCard | null;
  refresh: () => boolean;
  getPotionBuyPrice: (card: BattleCard) => number;
  getMixPrice: () => number;
  getRefreshPrice: () => number;
}

export interface TrinketShopCommands {
  buy: (trinket: TrinketEntry, slotKey: string) => boolean;
  refresh: () => boolean;
  getBuyPrice: (_trinket: TrinketEntry) => number;
  getRefreshPrice: () => number;
}

export interface EquipmentShopCommands {
  buy: (instance: GearInstance, slotKey: string) => boolean;
  refresh: () => boolean;
  getBuyPrice: (instance: GearInstance) => number;
  getRefreshPrice: () => number;
}

export interface ShopActions {
  merchant: MerchantShopCommands;
  alchemist: AlchemistShopCommands;
  trinket: TrinketShopCommands;
  equipment: EquipmentShopCommands;
}
