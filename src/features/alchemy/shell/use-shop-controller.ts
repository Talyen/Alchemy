// Shop and alchemist purchase controller for pricing, refreshes, removals, and potion mixing.
import { useRef, type RefObject } from "react";
import { getOfferableCardPool, getStandardPotionPool, type BattleCard, type TrinketEntry } from "@/lib/game-data";
import { computeTrinketManifest } from "@/lib/trinkets";
import { appendUnique } from "@/lib/utils";
import {
  appendCardToRunWithDiscovery,
  appendTrinketToRunWithDiscovery,
} from "@/features/alchemy/run-loop/run/deck-mutations";
import { refreshOfferings, refreshShopOfferings, spendRunGold } from "@/features/alchemy/run-loop/shop-transactions";
import { applyMixToDeck, tryCreateMixedPotion } from "@/lib/alchemist";
import {
  ALCHEMIST_MIX_PRICE,
  ALCHEMIST_POTION_PRICE,
  ALCHEMIST_REFRESH_PRICE,
  SHOP_CARD_PRICE,
  SHOP_REFRESH_PRICE,
  SHOP_REMOVE_PRICE,
  SHOP_CARDS_OFFERED,
  ALCHEMIST_POTIONS_OFFERED,
  TRINKET_SHOP_TRINKET_PRICE,
  MIXED_POTION_CARD_ID,
} from "@/lib/game-constants";
import {
  createInitialShopState,
  createInitialAlchemistState,
  createInitialTrinketShopState,
  createInitialEquipmentShopState,
  resampleTrinketShopOfferings,
  resampleEquipmentShopOfferings,
} from "@/features/alchemy/run-loop/shop/shop-state-init";
import {
  computeShopBuyPrice,
  computeShopRefreshPrice,
  computeShopServicePrice,
  getCardBuyTalentDiscounts,
  getGenericBuyTalentDiscounts,
} from "@/features/alchemy/run-loop/shop/shop-pricing";
import { getEquipmentShopPrice } from "@/features/alchemy/run-loop/shop/shop-gear-pricing";
import { useRunSessionShopSlice } from "@/features/alchemy/shared/stores/run-session-facade";
import {
  setAlchemistState,
  setShopState,
  setTrinketShopState,
  setEquipmentShopState,
} from "@/features/alchemy/shared/stores/run-session-facade";
import type { RunStateController, TalentStateController } from "@/features/alchemy/shared/stores/run-session-facade";
import type { GearInstance } from "@/lib/gear";
import { useGearStore } from "@/features/alchemy/shared/stores/gear-store";

import { useAppStore } from "@/features/alchemy/shared/stores/app-store";
import type { HomesteadEffectManifest } from "@/lib/homestead/types";

function markSlotPurchased(keys: string[], slotKey: string): string[] {
  return keys.includes(slotKey) ? keys : [...keys, slotKey];
}

export function useShopController({
  run,
  talents,
  homesteadEffectsRef,
}: {
  run: RunStateController;
  talents: TalentStateController;
  homesteadEffectsRef: RefObject<HomesteadEffectManifest>;
}) {
  const { shopState, alchemistState, trinketShopState, equipmentShopState } = useRunSessionShopSlice();

  const shopDiscountConsumed = useRef(false);
  const alchemistDiscountConsumed = useRef(false);
  const trinketDiscountConsumed = useRef(false);
  const equipmentDiscountConsumed = useRef(false);

  const merchantsFavorDiscount = computeTrinketManifest(run.runTrinkets).merchantsFavorDiscount;
  const gearAstralChanceBonus = () => homesteadEffectsRef.current.gearAstralChanceBonus;

  function purchaseItem(
    basePrice: number,
    haggleDiscount: number,
    apothecaryDiscount: number,
    firstPurchaseUsed: boolean,
    discountConsumed: { current: boolean },
    markFirstPurchase: () => void,
    onAcquire: () => void,
  ): boolean {
    const price = computeShopBuyPrice({
      basePrice,
      haggleDiscount,
      apothecaryDiscount,
      merchantsFavorDiscount,
      firstPurchaseUsed,
      favorConsumed: discountConsumed.current,
    });
    if (run.runGold < price) return false;
    spendRunGold(price, run.setRunGold);
    onAcquire();
    if (!firstPurchaseUsed && !discountConsumed.current && merchantsFavorDiscount > 0) {
      discountConsumed.current = true;
    }
    markFirstPurchase();
    return true;
  }

  function getMerchantCardBuyPrice(card: BattleCard) {
    const { haggleDiscount, apothecaryDiscount } = getCardBuyTalentDiscounts(card, talents.talentEffects);
    return computeShopBuyPrice({
      basePrice: SHOP_CARD_PRICE,
      haggleDiscount,
      apothecaryDiscount,
      merchantsFavorDiscount,
      firstPurchaseUsed: shopState.firstPurchaseUsed,
      favorConsumed: shopDiscountConsumed.current,
    });
  }

  function getAlchemistPotionBuyPrice(card: BattleCard) {
    const { haggleDiscount, apothecaryDiscount } = getCardBuyTalentDiscounts(card, talents.talentEffects);
    return computeShopBuyPrice({
      basePrice: ALCHEMIST_POTION_PRICE,
      haggleDiscount,
      apothecaryDiscount,
      merchantsFavorDiscount,
      firstPurchaseUsed: alchemistState.firstPurchaseUsed,
      favorConsumed: alchemistDiscountConsumed.current,
    });
  }

  function getTrinketBuyPrice(_trinket: TrinketEntry) {
    const { haggleDiscount, apothecaryDiscount } = getGenericBuyTalentDiscounts(talents.talentEffects);
    return computeShopBuyPrice({
      basePrice: TRINKET_SHOP_TRINKET_PRICE,
      haggleDiscount,
      apothecaryDiscount,
      merchantsFavorDiscount,
      firstPurchaseUsed: trinketShopState.firstPurchaseUsed,
      favorConsumed: trinketDiscountConsumed.current,
    });
  }

  function getGearBuyPrice(instance: GearInstance) {
    const { haggleDiscount, apothecaryDiscount } = getGenericBuyTalentDiscounts(talents.talentEffects);
    return computeShopBuyPrice({
      basePrice: getEquipmentShopPrice(instance),
      haggleDiscount,
      apothecaryDiscount,
      merchantsFavorDiscount,
      firstPurchaseUsed: equipmentShopState.firstPurchaseUsed,
      favorConsumed: equipmentDiscountConsumed.current,
    });
  }

  function getShopRefreshPrice(refreshesLeft: number) {
    return computeShopRefreshPrice(SHOP_REFRESH_PRICE, talents.talentEffects.shopFreeRefresh, refreshesLeft);
  }

  function getAlchemistRefreshPrice(refreshesLeft: number) {
    return computeShopRefreshPrice(ALCHEMIST_REFRESH_PRICE, talents.talentEffects.shopFreeRefresh, refreshesLeft);
  }

  const getTrinketRefreshPrice = getShopRefreshPrice;
  const getEquipmentRefreshPrice = getShopRefreshPrice;

  function getRemoveCardPrice() {
    return computeShopServicePrice(SHOP_REMOVE_PRICE, talents.talentEffects.removeCardDiscount);
  }

  function getMixPotionPrice() {
    return computeShopServicePrice(ALCHEMIST_MIX_PRICE, talents.talentEffects.mixPotionDiscount);
  }

  function handleShopBuyCard(card: BattleCard, slotKey: string): boolean {
    const { haggleDiscount, apothecaryDiscount } = getCardBuyTalentDiscounts(card, talents.talentEffects);
    return purchaseItem(
      SHOP_CARD_PRICE,
      haggleDiscount,
      apothecaryDiscount,
      shopState.firstPurchaseUsed,
      shopDiscountConsumed,
      () =>
        setShopState((p) => ({
          ...p,
          firstPurchaseUsed: true,
          purchasedSlotKeys: markSlotPurchased(p.purchasedSlotKeys, slotKey),
        })),
      () => appendCardToRunWithDiscovery(card, run.setRunDeck),
    );
  }

  function handleShopRemoveCard(index: number) {
    if (shopState.removeUsed) return;
    const price = getRemoveCardPrice();
    if (run.runGold < price) return;
    spendRunGold(price, run.setRunGold);
    run.setRunDeck((p) => p.filter((_, i) => i !== index));
    setShopState((p) => ({ ...p, removeUsed: true }));
  }

  function handleShopRefresh() {
    const price = getShopRefreshPrice(shopState.refreshesLeft);
    refreshOfferings({
      price,
      refreshesLeft: shopState.refreshesLeft,
      runGold: run.runGold,
      pool: getOfferableCardPool(),
      currentItems: shopState.cards,
      count: SHOP_CARDS_OFFERED,
      setRunGold: run.setRunGold,
      setState: setShopState,
      mapState: (p, cards) => ({
        ...p,
        cards,
        refreshesLeft: p.refreshesLeft - 1,
        purchasedSlotKeys: [],
      }),
      deck: run.runDeck,
    });
  }

  function handleAlchemistBuyCard(card: BattleCard, slotKey: string): boolean {
    const { haggleDiscount, apothecaryDiscount } = getCardBuyTalentDiscounts(card, talents.talentEffects);
    return purchaseItem(
      ALCHEMIST_POTION_PRICE,
      haggleDiscount,
      apothecaryDiscount,
      alchemistState.firstPurchaseUsed,
      alchemistDiscountConsumed,
      () =>
        setAlchemistState((p) => ({
          ...p,
          firstPurchaseUsed: true,
          purchasedSlotKeys: markSlotPurchased(p.purchasedSlotKeys, slotKey),
        })),
      () => appendCardToRunWithDiscovery(card, run.setRunDeck),
    );
  }

  function handleAlchemistRefresh() {
    const price = getAlchemistRefreshPrice(alchemistState.refreshesLeft);
    refreshOfferings({
      price,
      refreshesLeft: alchemistState.refreshesLeft,
      runGold: run.runGold,
      pool: getStandardPotionPool(),
      currentItems: alchemistState.potions,
      count: ALCHEMIST_POTIONS_OFFERED,
      setRunGold: run.setRunGold,
      setState: setAlchemistState,
      mapState: (p, potions) => ({
        ...p,
        potions,
        refreshesLeft: p.refreshesLeft - 1,
        purchasedSlotKeys: [],
      }),
      deck: run.runDeck,
    });
  }

  function handleAlchemistMixPotions(indexA: number, indexB: number): BattleCard | null {
    const price = getMixPotionPrice();
    if (run.runGold < price) return null;
    const deck = run.runDeck;
    const cardA = deck[indexA];
    const cardB = deck[indexB];

    const mixed = tryCreateMixedPotion(cardA, cardB, talents.talentEffects.potionMixPotency ?? 0);
    if (!mixed) return null;

    spendRunGold(price, run.setRunGold);
    run.setRunDeck((p) => applyMixToDeck(p, indexA, indexB, mixed));
    setAlchemistState((p) => ({ ...p, mixUsed: true }));
    useAppStore.getState().setDiscoveredCardIds((cur) => appendUnique(cur, MIXED_POTION_CARD_ID));
    return mixed;
  }

  function handleTrinketShopBuy(trinket: TrinketEntry, slotKey: string): boolean {
    const { haggleDiscount, apothecaryDiscount } = getGenericBuyTalentDiscounts(talents.talentEffects);
    return purchaseItem(
      TRINKET_SHOP_TRINKET_PRICE,
      haggleDiscount,
      apothecaryDiscount,
      trinketShopState.firstPurchaseUsed,
      trinketDiscountConsumed,
      () =>
        setTrinketShopState((p) => ({
          ...p,
          firstPurchaseUsed: true,
          purchasedSlotKeys: markSlotPurchased(p.purchasedSlotKeys, slotKey),
        })),
      () => appendTrinketToRunWithDiscovery(trinket.id, run.setRunTrinkets),
    );
  }

  function handleTrinketShopRefresh() {
    const price = getTrinketRefreshPrice(trinketShopState.refreshesLeft);
    refreshShopOfferings({
      price,
      refreshesLeft: trinketShopState.refreshesLeft,
      runGold: run.runGold,
      setRunGold: run.setRunGold,
      setState: setTrinketShopState,
      resample: () => resampleTrinketShopOfferings(),
      mapState: (p, trinkets) => ({
        ...p,
        trinkets: trinkets as TrinketEntry[],
        refreshesLeft: p.refreshesLeft - 1,
        purchasedSlotKeys: [],
      }),
    });
  }

  function handleEquipmentShopBuy(instance: GearInstance): boolean {
    const { haggleDiscount, apothecaryDiscount } = getGenericBuyTalentDiscounts(talents.talentEffects);
    return purchaseItem(
      getEquipmentShopPrice(instance),
      haggleDiscount,
      apothecaryDiscount,
      equipmentShopState.firstPurchaseUsed,
      equipmentDiscountConsumed,
      () =>
        setEquipmentShopState((p) => ({
          ...p,
          firstPurchaseUsed: true,
          purchasedSlotKeys: markSlotPurchased(p.purchasedSlotKeys, instance.instanceId),
        })),
      () => useGearStore.getState().addInstance(instance, run.characterId),
    );
  }

  function handleEquipmentShopRefresh() {
    const price = getEquipmentRefreshPrice(equipmentShopState.refreshesLeft);
    refreshShopOfferings({
      price,
      refreshesLeft: equipmentShopState.refreshesLeft,
      runGold: run.runGold,
      setRunGold: run.setRunGold,
      setState: setEquipmentShopState,
      resample: () => resampleEquipmentShopOfferings(Math.random, gearAstralChanceBonus()),
      mapState: (p, gear) => ({
        ...p,
        gear: gear as GearInstance[],
        refreshesLeft: p.refreshesLeft - 1,
        purchasedSlotKeys: [],
      }),
    });
  }

  return {
    initShop: () => {
      shopDiscountConsumed.current = false;
      setShopState(createInitialShopState(run.runDeck));
    },
    initAlchemist: () => {
      alchemistDiscountConsumed.current = false;
      setAlchemistState(createInitialAlchemistState(run.runDeck));
    },
    initTrinketShop: () => {
      trinketDiscountConsumed.current = false;
      setTrinketShopState(createInitialTrinketShopState());
    },
    initEquipmentShop: () => {
      equipmentDiscountConsumed.current = false;
      setEquipmentShopState(createInitialEquipmentShopState(Math.random, gearAstralChanceBonus()));
    },
    handleShopBuyCard,
    handleShopRemoveCard,
    handleShopRefresh,
    handleAlchemistBuyCard,
    handleAlchemistRefresh,
    handleAlchemistMixPotions,
    handleTrinketShopBuy,
    handleTrinketShopRefresh,
    handleEquipmentShopBuy,
    handleEquipmentShopRefresh,
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
    shopCards: shopState.cards,
    alchemistPotions: alchemistState.potions,
  };
}
