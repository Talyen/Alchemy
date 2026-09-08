import type { EncounterRewardTraitId } from "@/lib/content-systems/encounter-traits";
import type { BattleCard, TrinketEntry, TalentEffectManifest } from "@/lib/game-data";
import type { GearInstance } from "@/lib/gear";
import type { HomesteadEffectManifest } from "@/lib/homestead/types";

export type ShopKind = "merchant" | "alchemist" | "trinket" | "equipment";

type ShopRefreshModifiers = readonly EncounterRewardTraitId[];

export interface CreateShopActionsDeps {
  talentEffects: TalentEffectManifest;
  homesteadEffects: Pick<HomesteadEffectManifest, "gearAstralChanceBonus" | "potionMixPotency">;
}

export interface MerchantShopCommands {
  initialize: () => void;
  buyCard: (card: BattleCard, slotKey: string) => boolean;
  removeCard: (index: number) => boolean;
  refresh: () => boolean;
  getCardBuyPrice: (card: BattleCard) => number;
  getRemoveCardPrice: () => number;
  getRefreshPrice: (refreshesLeft: number, modifiers?: ShopRefreshModifiers) => number;
}

export interface AlchemistShopCommands {
  initialize: () => void;
  buyPotion: (card: BattleCard, slotKey: string) => boolean;
  mixPotions: (indexA: number, indexB: number) => BattleCard | null;
  refresh: () => boolean;
  getPotionBuyPrice: (card: BattleCard) => number;
  getMixPrice: () => number;
  getRefreshPrice: (refreshesLeft: number, modifiers?: ShopRefreshModifiers) => number;
}

export interface TrinketShopCommands {
  initialize: () => void;
  buy: (trinket: TrinketEntry, slotKey: string) => boolean;
  refresh: () => boolean;
  getBuyPrice: (_trinket: TrinketEntry) => number;
  getRefreshPrice: (refreshesLeft: number, modifiers?: ShopRefreshModifiers) => number;
}

export interface EquipmentShopCommands {
  initialize: () => void;
  buy: (instance: GearInstance, slotKey: string) => boolean;
  refresh: () => boolean;
  getBuyPrice: (instance: GearInstance) => number;
  getRefreshPrice: (refreshesLeft: number, modifiers?: ShopRefreshModifiers) => number;
}

export interface ShopActions {
  initialize: (kind: ShopKind) => void;
  merchant: MerchantShopCommands;
  alchemist: AlchemistShopCommands;
  trinket: TrinketShopCommands;
  equipment: EquipmentShopCommands;
}
