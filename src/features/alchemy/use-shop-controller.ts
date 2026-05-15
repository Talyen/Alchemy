// Shop and alchemist purchase controller for pricing, refreshes, removals, and potion mixing.
// Depends on run/talent state, sampled shop state, trinket pricing, audio, and mixer helpers.
// Used by the top-level controller so offer storage stays separate from purchase rules.
import { useCallback, useRef } from "react";
import { cardLibrary, type BattleCard } from "@/lib/game-data";
import { playGoldSpend } from "@/lib/audio";
import { computeTrinketManifest } from "@/lib/trinkets";
import { appendUnique } from "@/lib/utils";
import { applyMixToDeck, tryCreateMixedPotion } from "./potion-mixer";
import { useShopState } from "./use-shop-state";
import {
  ALCHEMIST_MIX_PRICE, ALCHEMIST_POTION_PRICE, ALCHEMIST_REFRESH_PRICE,
  SHOP_CARD_PRICE, SHOP_REFRESH_PRICE, SHOP_REMOVE_PRICE,
  SHOP_CARDS_OFFERED, ALCHEMIST_POTIONS_OFFERED, MIXED_POTION_CARD_ID, POTION_CARD_ID_FRAGMENT,
} from "@/lib/game-constants";
import { resampleItems } from "./utils";
import type { RunStateController } from "./use-run-state";
import type { TalentStateController } from "./use-talent-state";

export function useShopController({
  run, talents,
  setDiscoveredCardIds,
}: {
  run: RunStateController;
  talents: TalentStateController;
  setDiscoveredCardIds: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  // Purchase/removal/refresh/mixing rules are grouped here so sampled offer state remains
  // a simple store and does not need to know about gold, talents, trinkets, or discovery.
  const { shopState, setShopState, alchemistState, setAlchemistState, initShop, initAlchemist } = useShopState();

  // Bug 6 guard: synchronous refs prevent double-applying the trinket discount if handlers
  // are called twice before React re-renders (rapid clicks, accessibility events, etc.).
  const shopDiscountConsumed = useRef(false);
  const alchemistDiscountConsumed = useRef(false);

  const wrappedInitShop = useCallback(() => {
    shopDiscountConsumed.current = false;
    initShop();
  }, [initShop]);

  const wrappedInitAlchemist = useCallback(() => {
    alchemistDiscountConsumed.current = false;
    initAlchemist();
  }, [initAlchemist]);

  function handleShopBuyCard(card: BattleCard) {
    // First-purchase pricing combines the talent discount with one trinket discount, then
    // marks the visit discount as spent even if future purchases happen in the same shop.
    let price = Math.max(0, SHOP_CARD_PRICE - talents.talentEffects.shopCardDiscount);
    if (!shopState.firstPurchaseUsed && !shopDiscountConsumed.current) {
      price = Math.max(0, price - computeTrinketManifest(run.runTrinkets).merchantsFavorDiscount);
      shopDiscountConsumed.current = true;
    }
    if (run.runGold < price) return null;
    if (price > 0) playGoldSpend();
    run.setRunGold((p) => Math.max(0, p - price)); run.setRunDeck((p) => [...p, card]);
    setDiscoveredCardIds((cur) => appendUnique(cur, card.id));
    setShopState((p) => ({ ...p, firstPurchaseUsed: true }));
  }

  function handleShopRemoveCard(index: number) {
    if (shopState.removeUsed) return;
    const price = Math.max(0, SHOP_REMOVE_PRICE - talents.talentEffects.removeCardDiscount);
    if (run.runGold < price) return null;
    if (price > 0) playGoldSpend();
    run.setRunGold((p) => Math.max(0, p - price)); run.setRunDeck((p) => p.filter((_, i) => i !== index));
    setShopState((p) => ({ ...p, removeUsed: true }));
  }

  function handleShopRefresh() {
    // Refreshes resample against the current offer list so the same cards are avoided, and
    // decrement the remaining refreshes after spending the visit's refresh opportunity.
    const price = talents.talentEffects.shopFreeRefresh && shopState.refreshesLeft > 0 ? 0 : SHOP_REFRESH_PRICE;
    if (shopState.refreshesLeft <= 0 || run.runGold < price) return;
    if (price > 0) playGoldSpend();
    run.setRunGold((g) => Math.max(0, g - price));
    setShopState((p) => ({ ...p, cards: resampleItems(cardLibrary, p.cards, SHOP_CARDS_OFFERED), refreshesLeft: p.refreshesLeft - 1 }));
  }

  function handleAlchemistBuyCard(card: BattleCard) {
    // Alchemist purchases mirror shop discovery/discount behavior but use potion pricing
    // and a separate first-purchase flag for this visit type.
    let price = Math.max(0, ALCHEMIST_POTION_PRICE - talents.talentEffects.potionDiscount);
    if (!alchemistState.firstPurchaseUsed && !alchemistDiscountConsumed.current) {
      price = Math.max(0, price - computeTrinketManifest(run.runTrinkets).merchantsFavorDiscount);
      alchemistDiscountConsumed.current = true;
    }
    if (run.runGold < price) return null;
    if (price > 0) playGoldSpend();
    run.setRunGold((p) => Math.max(0, p - price)); run.setRunDeck((p) => [...p, card]);
    setDiscoveredCardIds((cur) => appendUnique(cur, card.id));
    setAlchemistState((p) => ({ ...p, firstPurchaseUsed: true }));
  }

  function handleAlchemistRefresh() {
    // Mixed potions are crafted outcomes, not shop stock, so refreshes sample only base
    // potion cards from the library.
    const potionPool = cardLibrary.filter((c) => c.id.includes(POTION_CARD_ID_FRAGMENT) && c.id !== MIXED_POTION_CARD_ID);
    if (alchemistState.refreshesLeft <= 0 || run.runGold < ALCHEMIST_REFRESH_PRICE) return;
    playGoldSpend();
    run.setRunGold((g) => Math.max(0, g - ALCHEMIST_REFRESH_PRICE));
    setAlchemistState((p) => ({ ...p, potions: resampleItems(potionPool, p.potions, ALCHEMIST_POTIONS_OFFERED), refreshesLeft: p.refreshesLeft - 1 }));
  }

  function handleAlchemistMixPotions(indexA: number, indexB: number): BattleCard | null {
    // Validate deck indices through createMixedPotion before spending gold. Only a valid
    // mix removes originals, appends the crafted card, and records Mixed Potion discovery.
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
    setAlchemistState((p) => ({ ...p, mixUsed: true }));
    setDiscoveredCardIds((cur) => appendUnique(cur, MIXED_POTION_CARD_ID));
    return mixed;
  }

  return {
    shopState, setShopState,
    alchemistState, setAlchemistState,
    initShop: wrappedInitShop, initAlchemist: wrappedInitAlchemist,
    handleShopBuyCard, handleShopRemoveCard, handleShopRefresh,
    handleAlchemistBuyCard, handleAlchemistRefresh, handleAlchemistMixPotions,
    get shopCards() { return shopState.cards; },
    get shopCardPrice() {
      const favorDiscount = !shopState.firstPurchaseUsed ? computeTrinketManifest(run.runTrinkets).merchantsFavorDiscount : 0;
      return Math.max(0, SHOP_CARD_PRICE - talents.talentEffects.shopCardDiscount - favorDiscount);
    },
    get shopRemovePrice() { return Math.max(0, SHOP_REMOVE_PRICE - talents.talentEffects.removeCardDiscount); },
    get shopRefreshPrice() {
      return talents.talentEffects.shopFreeRefresh && shopState.refreshesLeft > 0 ? 0 : SHOP_REFRESH_PRICE;
    },
    get shopRefreshesLeft() { return shopState.refreshesLeft; },
    get shopRemoveUsed() { return shopState.removeUsed; },
    get alchemistPotions() { return alchemistState.potions; },
    get alchemistRefreshesLeft() { return alchemistState.refreshesLeft; },
    get alchemistPotionPrice() {
      const favorDiscount = !alchemistState.firstPurchaseUsed ? computeTrinketManifest(run.runTrinkets).merchantsFavorDiscount : 0;
      return Math.max(0, ALCHEMIST_POTION_PRICE - talents.talentEffects.potionDiscount - favorDiscount);
    },
    get alchemistMixPrice() { return Math.max(0, ALCHEMIST_MIX_PRICE - talents.talentEffects.mixPotionDiscount); },
    get alchemistMixUsed() { return alchemistState.mixUsed; },
  };
}
