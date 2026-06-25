// Pure factory for shop actions and selectors. No React dependencies.
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
import { SHOP_CARDS_OFFERED, ALCHEMIST_POTIONS_OFFERED, MIXED_POTION_CARD_ID } from "@/lib/game-constants";
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
import { type BattleCard, type TrinketEntry } from "@/lib/game-data";
import { getOfferableCardPool, getStandardPotionPool } from "@/lib/game-data/cards/card-pools";
import type { GearInstance } from "@/lib/gear";
import { useGearStore } from "@/features/alchemy/shared/stores/gear-store";
import { useAppStore } from "@/features/alchemy/shared/stores/app-store";
import type { CreateShopActionsDeps, ShopActions } from "./shop-action-types";
import { createShopPriceSelectors } from "./shop-price-selectors";

export function createShopActions(deps: CreateShopActionsDeps): ShopActions {
  const {
    run,
    talents,
    homesteadEffects,
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
    setEquipmentShopState(createInitialEquipmentShopState(activeRng, homesteadEffects.gearAstralChanceBonus));
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
    resample: () => resampleEquipmentShopOfferings(activeRng, homesteadEffects.gearAstralChanceBonus),
    getMapState: (prev, gear) => ({
      ...prev,
      gear: gear as GearInstance[],
      refreshesLeft: prev.refreshesLeft - 1,
      purchasedSlotKeys: [],
    }),
  });

  // ======== Selectors ========

  const {
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
  } = createShopPriceSelectors({
    run,
    talents,
    shopState,
    alchemistState,
    trinketShopState,
    equipmentShopState,
  });

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
