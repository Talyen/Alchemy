import type { BattleCard, TrinketEntry, TalentEffectManifest } from "@/lib/game-data";
import type { GearInstance } from "@/lib/gear";
import type { HomesteadEffectManifest } from "@/lib/homestead/types";

export type ShopKind = "merchant" | "alchemist" | "trinket" | "equipment";

export interface CreateShopActionsDeps {
  talentEffects: TalentEffectManifest;
  homesteadEffects: HomesteadEffectManifest;
}

export interface MerchantShopCommands {
  initialize: () => void;
  buyCard: (card: BattleCard, slotKey: string) => boolean;
  removeCard: (index: number) => boolean;
  refresh: () => boolean;
  getCardBuyPrice: (card: BattleCard) => number;
  getRemoveCardPrice: () => number;
  getRefreshPrice: (refreshesLeft: number) => number;
}

export interface AlchemistShopCommands {
  initialize: () => void;
  buyPotion: (card: BattleCard, slotKey: string) => boolean;
  mixPotions: (indexA: number, indexB: number) => BattleCard | null;
  refresh: () => boolean;
  getPotionBuyPrice: (card: BattleCard) => number;
  getMixPrice: () => number;
  getRefreshPrice: (refreshesLeft: number) => number;
}

export interface TrinketShopCommands {
  initialize: () => void;
  buy: (trinket: TrinketEntry, slotKey: string) => boolean;
  refresh: () => boolean;
  getBuyPrice: (trinket: TrinketEntry) => number;
  getRefreshPrice: (refreshesLeft: number) => number;
}

export interface EquipmentShopCommands {
  initialize: () => void;
  buy: (instance: GearInstance) => boolean;
  refresh: () => boolean;
  getBuyPrice: (instance: GearInstance) => number;
  getRefreshPrice: (refreshesLeft: number) => number;
}

export interface ShopActions {
  initialize: (kind: ShopKind) => void;
  merchant: MerchantShopCommands;
  alchemist: AlchemistShopCommands;
  trinket: TrinketShopCommands;
  equipment: EquipmentShopCommands;
}
