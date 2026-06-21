// Pure factory for shop actions and selectors. No React dependencies.
import { type RefObject } from "react";
import { computeTrinketManifest } from "@/lib/trinkets";
import { appendUnique } from "@/lib/utils";
import {
  appendCardToRunWithDiscovery,
  appendTrinketToRunWithDiscovery,
} from "@/features/alchemy/run-loop/run/deck-mutations";
import {
  makeCardRefreshHandler,
  makeShopRefreshHandler,
  markSlotPurchased,
  spendRunGold,
} from "@/features/alchemy/run-loop/shop-transactions";
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
  type ShopState,
  type AlchemistState,
  type TrinketShopState,
  type EquipmentShopState,
} from "@/features/alchemy/run-loop/shop/shop-state-init";
import {
  computeShopRefreshPrice,
  computeShopServicePrice,
  getCardBuyTalentDiscounts,
  getGenericBuyTalentDiscounts,
  makeBuyPriceGetter,
} from "@/features/alchemy/run-loop/shop/shop-pricing";
import { getEquipmentShopPrice } from "@/features/alchemy/run-loop/shop/shop-gear-pricing";
import { type BattleCard, type TrinketEntry, getOfferableCardPool, getStandardPotionPool } from "@/lib/game-data";
import type { GearInstance } from "@/lib/gear";
import type { RunStateController, TalentStateController } from "@/features/alchemy/shared/stores/run-session-facade";
import type { HomesteadEffectManifest } from "@/lib/homestead/types";
import { useGearStore } from "@/features/alchemy/shared/stores/gear-store";
import { useAppStore } from "@/features/alchemy/shared/stores/app-store";

type ShopStates = {
  shopState: ShopState;
  alchemistState: AlchemistState;
  trinketShopState: TrinketShopState;
  equipmentShopState: EquipmentShopState;
};

type ShopSetters = {
  setShopState: (state: ShopState | ((prev: ShopState) => ShopState)) => void;
  setAlchemistState: (state: AlchemistState | ((prev: AlchemistState) => AlchemistState)) => void;
  setTrinketShopState: (state: TrinketShopState | ((prev: TrinketShopState) => TrinketShopState)) => void;
  setEquipmentShopState: (state: EquipmentShopState | ((prev: EquipmentShopState) => EquipmentShopState)) => void;
};

export type CreateShopActionsDeps = {
  run: RunStateController;
  talents: TalentStateController;
  homesteadEffectsRef: RefObject<HomesteadEffectManifest>;
  rng?: () => number;
} & ShopStates &
  ShopSetters;

export type ShopActions = {
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
};

export function createShopActions(deps: CreateShopActionsDeps): ShopActions {
  const {
    run,
    talents,
    homesteadEffectsRef,
    shopState,
    alchemistState,
    trinketShopState,
    equipmentShopState,
    setShopState,
    setAlchemistState,
    setTrinketShopState,
    setEquipmentShopState,
  } = deps;

  const activeRng = deps.rng ?? Math.random;

  // Shared helper for all four buy paths
  function buyInShop<T extends { firstPurchaseUsed: boolean; purchasedSlotKeys: string[] }>(
    price: number,
    setState: (updater: (prev: T) => T) => void,
    slotKey: string,
    onAcquire: () => void,
  ): boolean {
    if (run.runGold < price) return false;
    spendRunGold(price, run.setRunGold);
    onAcquire();
    setState((p) => ({
      ...p,
      firstPurchaseUsed: true,
      purchasedSlotKeys: markSlotPurchased(p.purchasedSlotKeys, slotKey),
    }));
    return true;
  }

  // ======== Init ========

  function initShop(): void {
    setShopState(createInitialShopState(run.runDeck));
  }

  function initAlchemist(): void {
    setAlchemistState(createInitialAlchemistState(run.runDeck));
  }

  function initTrinketShop(): void {
    setTrinketShopState(createInitialTrinketShopState());
  }

  function initEquipmentShop(): void {
    setEquipmentShopState(
      createInitialEquipmentShopState(activeRng, homesteadEffectsRef.current.gearAstralChanceBonus),
    );
  }

  // ======== Merchant Shop ========

  function handleShopBuyCard(card: BattleCard, slotKey: string): boolean {
    return buyInShop(
      getMerchantCardBuyPrice(card),
      setShopState as (updater: (prev: ShopState) => ShopState) => void,
      slotKey,
      () => appendCardToRunWithDiscovery(card, run.setRunDeck),
    );
  }

  function handleShopRemoveCard(index: number): void {
    if (shopState.removeUsed) return;
    if (index < 0 || index >= run.runDeck.length) return;
    const price = getRemoveCardPrice();
    if (run.runGold < price) return;
    spendRunGold(price, run.setRunGold);
    run.setRunDeck((p) => p.filter((_, i) => i !== index));
    setShopState((p) => ({ ...p, removeUsed: true }));
  }

  const handleShopRefresh = makeCardRefreshHandler({
    getPrice: () => getShopRefreshPrice(shopState.refreshesLeft),
    getRefreshesLeft: () => shopState.refreshesLeft,
    getRunGold: () => run.runGold,
    setRunGold: run.setRunGold,
    getPool: getOfferableCardPool,
    getCurrentItems: () => shopState.cards,
    count: SHOP_CARDS_OFFERED,
    setState: setShopState,
    getDeck: () => run.runDeck,
    getMapState: (prev, cards) => ({
      ...prev,
      cards,
      refreshesLeft: prev.refreshesLeft - 1,
      purchasedSlotKeys: [],
    }),
  });

  // ======== Alchemist ========

  function handleAlchemistBuyCard(card: BattleCard, slotKey: string): boolean {
    return buyInShop(
      getAlchemistPotionBuyPrice(card),
      setAlchemistState as (updater: (prev: AlchemistState) => AlchemistState) => void,
      slotKey,
      () => appendCardToRunWithDiscovery(card, run.setRunDeck),
    );
  }

  const handleAlchemistRefresh = makeCardRefreshHandler({
    getPrice: () => getAlchemistRefreshPrice(alchemistState.refreshesLeft),
    getRefreshesLeft: () => alchemistState.refreshesLeft,
    getRunGold: () => run.runGold,
    setRunGold: run.setRunGold,
    getPool: getStandardPotionPool,
    getCurrentItems: () => alchemistState.potions,
    count: ALCHEMIST_POTIONS_OFFERED,
    setState: setAlchemistState,
    getDeck: () => run.runDeck,
    getMapState: (prev, potions) => ({
      ...prev,
      potions,
      refreshesLeft: prev.refreshesLeft - 1,
      purchasedSlotKeys: [],
    }),
  });

  function handleAlchemistMixPotions(indexA: number, indexB: number): BattleCard | null {
    if (alchemistState.mixUsed) return null;
    const price = getMixPotionPrice();
    if (run.runGold < price) return null;
    const deck = run.runDeck;
    if (indexA < 0 || indexB < 0 || indexA >= deck.length || indexB >= deck.length || indexA === indexB) return null;
    const cardA = deck[indexA];
    const cardB = deck[indexB];

    // Any attempt consumes the one mix slot — even programmatic edge cases
    spendRunGold(price, run.setRunGold);
    setAlchemistState((p) => ({ ...p, mixUsed: true }));

    const mixed = tryCreateMixedPotion(cardA, cardB, talents.talentEffects.potionMixPotency);
    if (mixed) {
      run.setRunDeck((p) => applyMixToDeck(p, indexA, indexB, mixed));
      useAppStore.getState().setDiscoveredCardIds((cur) => appendUnique(cur, MIXED_POTION_CARD_ID));
    }
    return mixed;
  }

  // ======== Trinket Shop ========

  function handleTrinketShopBuy(trinket: TrinketEntry, slotKey: string): boolean {
    return buyInShop(
      getTrinketBuyPrice(trinket),
      setTrinketShopState as (updater: (prev: TrinketShopState) => TrinketShopState) => void,
      slotKey,
      () => appendTrinketToRunWithDiscovery(trinket.id, run.setRunTrinkets),
    );
  }

  const handleTrinketShopRefresh = makeShopRefreshHandler({
    getPrice: () => getShopRefreshPrice(trinketShopState.refreshesLeft),
    getRefreshesLeft: () => trinketShopState.refreshesLeft,
    getRunGold: () => run.runGold,
    setRunGold: run.setRunGold,
    setState: setTrinketShopState,
    resample: () => resampleTrinketShopOfferings(),
    getMapState: (prev, trinkets) => ({
      ...prev,
      trinkets: trinkets as TrinketEntry[],
      refreshesLeft: prev.refreshesLeft - 1,
      purchasedSlotKeys: [],
    }),
  });

  // ======== Equipment Shop (gear lives in the cross-run armory store, not the run deck — see ARMORY.md) ========

  function handleEquipmentShopBuy(instance: GearInstance): boolean {
    return buyInShop(
      getGearBuyPrice(instance),
      setEquipmentShopState as (updater: (prev: EquipmentShopState) => EquipmentShopState) => void,
      instance.instanceId,
      () => useGearStore.getState().addInstance(instance, run.characterId),
    );
  }

  const handleEquipmentShopRefresh = makeShopRefreshHandler({
    getPrice: () => getShopRefreshPrice(equipmentShopState.refreshesLeft),
    getRefreshesLeft: () => equipmentShopState.refreshesLeft,
    getRunGold: () => run.runGold,
    setRunGold: run.setRunGold,
    setState: setEquipmentShopState,
    resample: () => resampleEquipmentShopOfferings(activeRng, homesteadEffectsRef.current.gearAstralChanceBonus),
    getMapState: (prev, gear) => ({
      ...prev,
      gear: gear as GearInstance[],
      refreshesLeft: prev.refreshesLeft - 1,
      purchasedSlotKeys: [],
    }),
  });

  // ======== Selectors ========

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
    initShop,
    initAlchemist,
    initTrinketShop,
    initEquipmentShop,
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
