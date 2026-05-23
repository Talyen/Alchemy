// Shop and alchemist purchase controller for pricing, refreshes, removals, and potion mixing.
// Depends on run/talent state, sampled shop state, trinket pricing, audio, and mixer helpers.
// Uses useScreenStore for shop/alchemist state.
import { useRef } from "react";
import { cardLibrary, type BattleCard } from "@/lib/game-data";
import { playGoldSpend } from "@/lib/audio";
import { computeTrinketManifest } from "@/lib/trinkets";
import { appendUnique } from "@/lib/utils";
import { applyMixToDeck, tryCreateMixedPotion } from "./potion-mixer";
import {
  ALCHEMIST_MIX_PRICE,
  ALCHEMIST_POTION_PRICE,
  ALCHEMIST_REFRESH_PRICE,
  SHOP_CARD_PRICE,
  SHOP_REFRESH_PRICE,
  SHOP_REMOVE_PRICE,
  SHOP_CARDS_OFFERED,
  ALCHEMIST_POTIONS_OFFERED,
  MIXED_POTION_CARD_ID,
  POTION_CARD_ID_SUFFIX,
} from "@/lib/game-constants";
import { resampleItems } from "./utils";
import { useScreenStore } from "./stores/screen-store";
import type { RunStateController } from "./use-run-state";
import type { TalentStateController } from "./use-talent-state";

export function useShopController({
  run,
  talents,
  setDiscoveredCardIds,
}: {
  run: RunStateController;
  talents: TalentStateController;
  setDiscoveredCardIds: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  const shopState = useScreenStore((s) => s.shopState);
  const alchemistState = useScreenStore((s) => s.alchemistState);

  const shopDiscountConsumed = useRef(false);
  const alchemistDiscountConsumed = useRef(false);

  function getStore() {
    return useScreenStore.getState();
  }

  function handleShopBuyCard(card: BattleCard) {
    let price = Math.max(0, SHOP_CARD_PRICE - talents.talentEffects.shopCardDiscount);
    if (!shopState.firstPurchaseUsed && !shopDiscountConsumed.current) {
      price = Math.max(0, price - computeTrinketManifest(run.runTrinkets).merchantsFavorDiscount);
      shopDiscountConsumed.current = true;
    }
    if (run.runGold < price) return null;
    if (price > 0) playGoldSpend();
    run.setRunGold((p) => Math.max(0, p - price));
    run.setRunDeck((p) => [...p, card]);
    setDiscoveredCardIds((cur) => appendUnique(cur, card.id));
    getStore().setShopState((p) => ({ ...p, firstPurchaseUsed: true }));
  }

  function handleShopRemoveCard(index: number) {
    if (shopState.removeUsed) return;
    const price = Math.max(0, SHOP_REMOVE_PRICE - talents.talentEffects.removeCardDiscount);
    if (run.runGold < price) return null;
    if (price > 0) playGoldSpend();
    run.setRunGold((p) => Math.max(0, p - price));
    run.setRunDeck((p) => p.filter((_, i) => i !== index));
    getStore().setShopState((p) => ({ ...p, removeUsed: true }));
  }

  function handleShopRefresh() {
    const price = talents.talentEffects.shopFreeRefresh && shopState.refreshesLeft > 0 ? 0 : SHOP_REFRESH_PRICE;
    if (shopState.refreshesLeft <= 0 || run.runGold < price) return;
    if (price > 0) playGoldSpend();
    run.setRunGold((g) => Math.max(0, g - price));
    getStore().setShopState((p) => ({
      ...p,
      cards: resampleItems(cardLibrary, p.cards, SHOP_CARDS_OFFERED),
      refreshesLeft: p.refreshesLeft - 1,
    }));
  }

  function handleAlchemistBuyCard(card: BattleCard) {
    let price = Math.max(0, ALCHEMIST_POTION_PRICE - talents.talentEffects.potionDiscount);
    if (!alchemistState.firstPurchaseUsed && !alchemistDiscountConsumed.current) {
      price = Math.max(0, price - computeTrinketManifest(run.runTrinkets).merchantsFavorDiscount);
      alchemistDiscountConsumed.current = true;
    }
    if (run.runGold < price) return null;
    if (price > 0) playGoldSpend();
    run.setRunGold((p) => Math.max(0, p - price));
    run.setRunDeck((p) => [...p, card]);
    setDiscoveredCardIds((cur) => appendUnique(cur, card.id));
    getStore().setAlchemistState((p) => ({ ...p, firstPurchaseUsed: true }));
  }

  function handleAlchemistRefresh() {
    const potionPool = cardLibrary.filter((c) => c.id.endsWith(POTION_CARD_ID_SUFFIX) && c.id !== MIXED_POTION_CARD_ID);
    if (alchemistState.refreshesLeft <= 0 || run.runGold < ALCHEMIST_REFRESH_PRICE) return;
    playGoldSpend();
    run.setRunGold((g) => Math.max(0, g - ALCHEMIST_REFRESH_PRICE));
    getStore().setAlchemistState((p) => ({
      ...p,
      potions: resampleItems(potionPool, p.potions, ALCHEMIST_POTIONS_OFFERED),
      refreshesLeft: p.refreshesLeft - 1,
    }));
  }

  function handleAlchemistMixPotions(indexA: number, indexB: number): BattleCard | null {
    const price = Math.max(0, ALCHEMIST_MIX_PRICE - talents.talentEffects.mixPotionDiscount);
    if (run.runGold < price) return null;
    const deck = run.runDeck;
    const cardA = deck[indexA];
    const cardB = deck[indexB];

    const mixed = tryCreateMixedPotion(cardA, cardB);
    if (!mixed) return null;

    if (price > 0) playGoldSpend();
    run.setRunGold((p) => Math.max(0, p - price));
    run.setRunDeck((p) => applyMixToDeck(p, indexA, indexB, mixed));
    getStore().setAlchemistState((p) => ({ ...p, mixUsed: true }));
    setDiscoveredCardIds((cur) => appendUnique(cur, MIXED_POTION_CARD_ID));
    return mixed;
  }

  return {
    initShop: () => {
      shopDiscountConsumed.current = false;
      getStore().initShop();
    },
    initAlchemist: () => {
      alchemistDiscountConsumed.current = false;
      getStore().initAlchemist();
    },
    handleShopBuyCard,
    handleShopRemoveCard,
    handleShopRefresh,
    handleAlchemistBuyCard,
    handleAlchemistRefresh,
    handleAlchemistMixPotions,
    get shopCards() {
      return useScreenStore.getState().shopState.cards;
    },
    get alchemistPotions() {
      return alchemistState.potions;
    },
  };
}
