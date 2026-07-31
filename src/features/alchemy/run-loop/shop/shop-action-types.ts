import type { BattleCard, TrinketEntry, TalentEffectManifest } from "@/lib/game-data";
import type { GearInstance } from "@/lib/gear";
import type { HomesteadEffectManifest } from "@/lib/homestead/types";
import type { AlchemistState, EquipmentShopState, ShopState, TrinketShopState } from "./shop-state-init";

interface ShopSetters {
  setShopState: (state: ShopState | ((prev: ShopState) => ShopState)) => void;
  setAlchemistState: (state: AlchemistState | ((prev: AlchemistState) => AlchemistState)) => void;
  setTrinketShopState: (state: TrinketShopState | ((prev: TrinketShopState) => TrinketShopState)) => void;
  setEquipmentShopState: (state: EquipmentShopState | ((prev: EquipmentShopState) => EquipmentShopState)) => void;
}

/** Shop command deps — run fields are read imperatively via readActiveRun at call time. */
export type CreateShopActionsDeps = {
  talentEffects: TalentEffectManifest;
  homesteadEffects: HomesteadEffectManifest;
  rng?: () => number;
} & ShopSetters;

export interface ShopActions {
  initShop: () => void;
  initAlchemist: () => void;
  initTrinketShop: () => void;
  initEquipmentShop: () => void;
  handleShopBuyCard: (card: BattleCard, slotKey: string) => boolean;
  handleShopRemoveCard: (index: number) => void;
  handleShopRefresh: () => void;
  handleAlchemistBuyCard: (card: BattleCard, slotKey: string) => boolean;
  handleAlchemistRefresh: () => void;
  handleAlchemistMixPotions: (indexA: number, indexB: number) => BattleCard | null;
  handleTrinketShopBuy: (trinket: TrinketEntry, slotKey: string) => boolean;
  handleTrinketShopRefresh: () => void;
  handleEquipmentShopBuy: (instance: GearInstance) => boolean;
  handleEquipmentShopRefresh: () => void;
  getMerchantCardBuyPrice: (card: BattleCard) => number;
  getAlchemistPotionBuyPrice: (card: BattleCard) => number;
  getTrinketBuyPrice: (_trinket: TrinketEntry) => number;
  getGearBuyPrice: (instance: GearInstance) => number;
  getShopRefreshPrice: (refreshesLeft: number) => number;
  getAlchemistRefreshPrice: (refreshesLeft: number) => number;
  getTrinketRefreshPrice: (refreshesLeft: number) => number;
  getEquipmentRefreshPrice: (refreshesLeft: number) => number;
  getRemoveCardPrice: () => number;
  getMixPotionPrice: () => number;
}
