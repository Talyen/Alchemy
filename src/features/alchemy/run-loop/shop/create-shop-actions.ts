// Pure factory for shop actions and selectors. No React dependencies.
import { type RefObject } from "react";
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
  type ShopState,
  type AlchemistState,
  type TrinketShopState,
  type EquipmentShopState,
} from "@/features/alchemy/run-loop/shop/shop-state-init";
import {
  computeShopBuyPrice,
  computeShopRefreshPrice,
  computeShopServicePrice,
  getCardBuyTalentDiscounts,
  getGenericBuyTalentDiscounts,
} from "@/features/alchemy/run-loop/shop/shop-pricing";
import { getEquipmentShopPrice } from "@/features/alchemy/run-loop/shop/shop-gear-pricing";
import { type BattleCard, type TrinketEntry, getOfferableCardPool, getStandardPotionPool } from "@/lib/game-data";
import type { GearInstance } from "@/lib/gear";
import type { RunStateController, TalentStateController } from "@/features/alchemy/shared/stores/run-session-facade";
import type { HomesteadEffectManifest } from "@/lib/homestead/types";
import { useGearStore } from "@/features/alchemy/shared/stores/gear-store";
import { useAppStore } from "@/features/alchemy/shared/stores/app-store";

export type ShopStates = {
  shopState: ShopState;
  alchemistState: AlchemistState;
  trinketShopState: TrinketShopState;
  equipmentShopState: EquipmentShopState;
};

export type ShopSetters = {
  setShopState: (state: ShopState | ((prev: ShopState) => ShopState)) => void;
  setAlchemistState: (state: AlchemistState | ((prev: AlchemistState) => AlchemistState)) => void;
  setTrinketShopState: (state: TrinketShopState | ((prev: TrinketShopState) => TrinketShopState)) => void;
  setEquipmentShopState: (state: EquipmentShopState | ((prev: EquipmentShopState) => EquipmentShopState)) => void;
};

export type CreateShopActionsDeps = {
  run: RunStateController;
  talents: TalentStateController;
  homesteadEffectsRef: RefObject<HomesteadEffectManifest>;
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

function markSlotPurchased(keys: string[], slotKey: string): string[] {
  return keys.includes(slotKey) ? keys : [...keys, slotKey];
}

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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- match signature
  function initAlchemist(): void {
    setAlchemistState(createInitialAlchemistState(run.runDeck));
  }

  function initTrinketShop(): void {
    setTrinketShopState(createInitialTrinketShopState());
  }

  function initEquipmentShop(): void {
    setEquipmentShopState(
      createInitialEquipmentShopState(Math.random, homesteadEffectsRef.current.gearAstralChanceBonus),
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

  function handleShopRefresh(): void {
    refreshOfferings({
      price: getShopRefreshPrice(shopState.refreshesLeft),
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

  // ======== Alchemist ========

  function handleAlchemistBuyCard(card: BattleCard, slotKey: string): boolean {
    return buyInShop(
      getAlchemistPotionBuyPrice(card),
      setAlchemistState as (updater: (prev: AlchemistState) => AlchemistState) => void,
      slotKey,
      () => appendCardToRunWithDiscovery(card, run.setRunDeck),
    );
  }

  function handleAlchemistRefresh(): void {
    refreshOfferings({
      price: getAlchemistRefreshPrice(alchemistState.refreshesLeft),
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
    if (indexA < 0 || indexB < 0 || indexA >= deck.length || indexB >= deck.length || indexA === indexB) return null;
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

  // ======== Trinket Shop ========

  function handleTrinketShopBuy(trinket: TrinketEntry, slotKey: string): boolean {
    return buyInShop(
      getTrinketBuyPrice(trinket),
      setTrinketShopState as (updater: (prev: TrinketShopState) => TrinketShopState) => void,
      slotKey,
      () => appendTrinketToRunWithDiscovery(trinket.id, run.setRunTrinkets),
    );
  }

  function handleTrinketShopRefresh(): void {
    refreshShopOfferings({
      price: getShopRefreshPrice(trinketShopState.refreshesLeft),
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

  // ======== Equipment Shop (gear lives in the cross-run armory store, not the run deck — see ARMORY.md) ========

  function handleEquipmentShopBuy(instance: GearInstance): boolean {
    return buyInShop(
      getGearBuyPrice(instance),
      setEquipmentShopState as (updater: (prev: EquipmentShopState) => EquipmentShopState) => void,
      instance.instanceId,
      () => useGearStore.getState().addInstance(instance, run.characterId),
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- match signature
  function handleEquipmentShopRefresh(): void {
    refreshShopOfferings({
      price: getShopRefreshPrice(equipmentShopState.refreshesLeft),
      refreshesLeft: equipmentShopState.refreshesLeft,
      runGold: run.runGold,
      setRunGold: run.setRunGold,
      setState: setEquipmentShopState,
      resample: () => resampleEquipmentShopOfferings(Math.random, homesteadEffectsRef.current.gearAstralChanceBonus),
      mapState: (p, gear) => ({
        ...p,
        gear: gear as GearInstance[],
        refreshesLeft: p.refreshesLeft - 1,
        purchasedSlotKeys: [],
      }),
    });
  }

  // ======== Selectors ========

  const merchantsFavorDiscount = computeTrinketManifest(run.runTrinkets).merchantsFavorDiscount;

  function getMerchantCardBuyPrice(card: BattleCard): number {
    const { haggleDiscount, apothecaryDiscount } = getCardBuyTalentDiscounts(card, talents.talentEffects);
    return computeShopBuyPrice({
      basePrice: SHOP_CARD_PRICE,
      haggleDiscount,
      apothecaryDiscount,
      merchantsFavorDiscount,
      firstPurchaseUsed: shopState.firstPurchaseUsed,
    });
  }

  function getAlchemistPotionBuyPrice(card: BattleCard): number {
    const { haggleDiscount, apothecaryDiscount } = getCardBuyTalentDiscounts(card, talents.talentEffects);
    return computeShopBuyPrice({
      basePrice: ALCHEMIST_POTION_PRICE,
      haggleDiscount,
      apothecaryDiscount,
      merchantsFavorDiscount,
      firstPurchaseUsed: alchemistState.firstPurchaseUsed,
    });
  }

  function getTrinketBuyPrice(_trinket: TrinketEntry): number {
    const { haggleDiscount } = getGenericBuyTalentDiscounts(talents.talentEffects);
    return computeShopBuyPrice({
      basePrice: TRINKET_SHOP_TRINKET_PRICE,
      haggleDiscount,
      apothecaryDiscount: 0,
      merchantsFavorDiscount,
      firstPurchaseUsed: trinketShopState.firstPurchaseUsed,
    });
  }

  function getGearBuyPrice(instance: GearInstance): number {
    const { haggleDiscount } = getGenericBuyTalentDiscounts(talents.talentEffects);
    return computeShopBuyPrice({
      basePrice: getEquipmentShopPrice(instance),
      haggleDiscount,
      apothecaryDiscount: 0,
      merchantsFavorDiscount,
      firstPurchaseUsed: equipmentShopState.firstPurchaseUsed,
    });
  }

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
    getTrinketRefreshPrice: getShopRefreshPrice,
    getEquipmentRefreshPrice: getShopRefreshPrice,
    getRemoveCardPrice,
    getMixPotionPrice,
    shopCards: shopState.cards,
    alchemistPotions: alchemistState.potions,
  };
}
