import type { BattleCard, TrinketEntry } from "@/lib/game-data";
import type { GearInstance } from "@/lib/gear";
import type { HomesteadEffectManifest } from "@/lib/homestead/types";
import type { RunStateController, TalentStateController } from "@/features/alchemy/shared/stores/run-session-facade";
import type { AlchemistState, EquipmentShopState, ShopState, TrinketShopState } from "./shop-state-init";

interface ShopStates {
  shopState: ShopState;
  alchemistState: AlchemistState;
  trinketShopState: TrinketShopState;
  equipmentShopState: EquipmentShopState;
}

interface ShopSetters {
  setShopState: (state: ShopState | ((prev: ShopState) => ShopState)) => void;
  setAlchemistState: (state: AlchemistState | ((prev: AlchemistState) => AlchemistState)) => void;
  setTrinketShopState: (state: TrinketShopState | ((prev: TrinketShopState) => TrinketShopState)) => void;
  setEquipmentShopState: (state: EquipmentShopState | ((prev: EquipmentShopState) => EquipmentShopState)) => void;
}

export type CreateShopActionsDeps = {
  run: RunStateController;
  talents: TalentStateController;
  homesteadEffects: HomesteadEffectManifest;
  rng?: () => number;
} & ShopStates &
  ShopSetters;

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
  shopCards: BattleCard[];
  alchemistPotions: BattleCard[];
}
