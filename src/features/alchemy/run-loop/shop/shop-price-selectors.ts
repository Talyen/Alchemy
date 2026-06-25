import { computeTrinketManifest } from "@/lib/trinkets";
import {
  ALCHEMIST_MIX_PRICE,
  ALCHEMIST_POTION_PRICE,
  ALCHEMIST_REFRESH_PRICE,
  SHOP_CARD_PRICE,
  SHOP_REFRESH_PRICE,
  SHOP_REMOVE_PRICE,
  TRINKET_SHOP_TRINKET_PRICE,
} from "@/lib/game-constants";
import { type BattleCard, type TrinketEntry } from "@/lib/game-data";
import type { GearInstance } from "@/lib/gear";
import type { RunStateController, TalentStateController } from "@/features/alchemy/shared/stores/run-session-facade";
import {
  computeShopRefreshPrice,
  computeShopServicePrice,
  getCardBuyTalentDiscounts,
  getGenericBuyTalentDiscounts,
  makeBuyPriceGetter,
} from "./shop-pricing";
import { getEquipmentShopPrice } from "./shop-gear-pricing";
import type { AlchemistState, EquipmentShopState, ShopState, TrinketShopState } from "./shop-state-init";

interface ShopPriceSelectorDeps {
  run: RunStateController;
  talents: TalentStateController;
  shopState: ShopState;
  alchemistState: AlchemistState;
  trinketShopState: TrinketShopState;
  equipmentShopState: EquipmentShopState;
}

export function createShopPriceSelectors({
  run,
  talents,
  shopState,
  alchemistState,
  trinketShopState,
  equipmentShopState,
}: ShopPriceSelectorDeps) {
  const merchantsFavorDiscount = computeTrinketManifest(run.runTrinkets).merchantsFavorDiscount;

  const getMerchantCardBuyPrice = makeBuyPriceGetter<BattleCard>(
    () => SHOP_CARD_PRICE,
    (card) => getCardBuyTalentDiscounts(card, talents.talentEffects),
    () => shopState.firstPurchaseUsed,
    merchantsFavorDiscount,
  );

  const getAlchemistPotionBuyPrice = makeBuyPriceGetter<BattleCard>(
    () => ALCHEMIST_POTION_PRICE,
    (card) => getCardBuyTalentDiscounts(card, talents.talentEffects),
    () => alchemistState.firstPurchaseUsed,
    merchantsFavorDiscount,
  );

  const getTrinketBuyPrice = makeBuyPriceGetter<TrinketEntry>(
    () => TRINKET_SHOP_TRINKET_PRICE,
    () => getGenericBuyTalentDiscounts(talents.talentEffects),
    () => trinketShopState.firstPurchaseUsed,
    merchantsFavorDiscount,
  );

  const getGearBuyPrice = makeBuyPriceGetter<GearInstance>(
    (instance) => getEquipmentShopPrice(instance),
    () => getGenericBuyTalentDiscounts(talents.talentEffects),
    () => equipmentShopState.firstPurchaseUsed,
    merchantsFavorDiscount,
  );

  function getShopRefreshPrice(refreshesLeft: number): number {
    return computeShopRefreshPrice(SHOP_REFRESH_PRICE, talents.talentEffects.shopFreeRefresh, refreshesLeft);
  }

  function getAlchemistRefreshPrice(refreshesLeft: number): number {
    return computeShopRefreshPrice(ALCHEMIST_REFRESH_PRICE, talents.talentEffects.shopFreeRefresh, refreshesLeft);
  }

  function getRemoveCardPrice(): number {
    return computeShopServicePrice(SHOP_REMOVE_PRICE, talents.talentEffects.removeCardDiscount);
  }

  function getMixPotionPrice(): number {
    return computeShopServicePrice(ALCHEMIST_MIX_PRICE, talents.talentEffects.mixPotionDiscount);
  }

  const getTrinketRefreshPrice = getShopRefreshPrice;
  const getEquipmentRefreshPrice = getShopRefreshPrice;

  return {
    getMerchantCardBuyPrice,
    getAlchemistPotionBuyPrice,
    getTrinketBuyPrice,
    getGearBuyPrice,
    getShopRefreshPrice,
    getAlchemistRefreshPrice,
    getTrinketRefreshPrice,
    getEquipmentRefreshPrice,
    getRemoveCardPrice,
    getMixPotionPrice,
  };
}
