// Shop and alchemist purchase controller for pricing, refreshes, removals, and potion mixing.
// Depends on run/talent state, sampled shop state, boon pricing, audio, and mixer helpers.
// Reads shop/alchemist via useRunSessionShopSlice; writes via run-session-facade.
import { useRef } from "react";
import { getOfferableCardPool, getStandardPotionPool, type BattleCard } from "@/lib/game-data";
import { computeTrinketManifest } from "@/lib/trinkets";
import { appendUnique } from "@/lib/utils";
import { appendCardToRunWithDiscovery } from "@/features/alchemy/run-loop/run/deck-mutations";
import { refreshOfferings, spendRunGold } from "@/features/alchemy/run-loop/shop-transactions";
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
  MIXED_POTION_CARD_ID,
} from "@/lib/game-constants";
import { createInitialShopState, createInitialAlchemistState } from "@/features/alchemy/run-loop/shop/shop-state-init";
import { useRunSessionShopSlice } from "@/features/alchemy/shared/stores/run-session-facade";
import { setAlchemistState, setShopState } from "@/features/alchemy/shared/stores/run-session-facade";
import { readRunSessionStore } from "@/features/alchemy/shared/stores/run-session-facade";
import type { RunStateController, TalentStateController } from "@/features/alchemy/shared/stores/run-session-facade";

import { useAppStore } from "@/features/alchemy/shared/stores/app-store";

export function useShopController({ run, talents }: { run: RunStateController; talents: TalentStateController }) {
  const { shopState, alchemistState } = useRunSessionShopSlice();

  const shopDiscountConsumed = useRef(false);
  const alchemistDiscountConsumed = useRef(false);

  function purchaseCard(
    card: BattleCard,
    basePrice: number,
    discount: number,
    firstPurchaseUsed: boolean,
    discountConsumed: { current: boolean },
    markFirstPurchase: () => void,
  ) {
    let price = Math.max(0, basePrice - discount);
    if (!firstPurchaseUsed && !discountConsumed.current) {
      price = Math.max(0, price - computeTrinketManifest(run.runTrinkets).merchantsFavorDiscount);
      discountConsumed.current = true;
    }
    if (run.runGold < price) return null;
    spendRunGold(price, run.setRunGold);
    appendCardToRunWithDiscovery(card, run.setRunDeck);
    markFirstPurchase();
    return card;
  }

  function handleShopBuyCard(card: BattleCard) {
    purchaseCard(
      card,
      SHOP_CARD_PRICE,
      talents.talentEffects.shopCardDiscount,
      shopState.firstPurchaseUsed,
      shopDiscountConsumed,
      () => setShopState((p) => ({ ...p, firstPurchaseUsed: true })),
    );
  }

  function handleShopRemoveCard(index: number) {
    if (shopState.removeUsed) return;
    const price = Math.max(0, SHOP_REMOVE_PRICE - talents.talentEffects.removeCardDiscount);
    if (run.runGold < price) return null;
    spendRunGold(price, run.setRunGold);
    run.setRunDeck((p) => p.filter((_, i) => i !== index));
    setShopState((p) => ({ ...p, removeUsed: true }));
  }

  function handleShopRefresh() {
    const price = talents.talentEffects.shopFreeRefresh && shopState.refreshesLeft > 0 ? 0 : SHOP_REFRESH_PRICE;
    refreshOfferings({
      price,
      refreshesLeft: shopState.refreshesLeft,
      runGold: run.runGold,
      pool: getOfferableCardPool(),
      currentItems: shopState.cards,
      count: SHOP_CARDS_OFFERED,
      setRunGold: run.setRunGold,
      setState: setShopState,
      mapState: (p, cards) => ({ ...p, cards, refreshesLeft: p.refreshesLeft - 1 }),
      deck: run.runDeck,
    });
  }

  function handleAlchemistBuyCard(card: BattleCard) {
    purchaseCard(
      card,
      ALCHEMIST_POTION_PRICE,
      talents.talentEffects.potionDiscount,
      alchemistState.firstPurchaseUsed,
      alchemistDiscountConsumed,
      () => setAlchemistState((p) => ({ ...p, firstPurchaseUsed: true })),
    );
  }

  function handleAlchemistRefresh() {
    refreshOfferings({
      price: ALCHEMIST_REFRESH_PRICE,
      refreshesLeft: alchemistState.refreshesLeft,
      runGold: run.runGold,
      pool: getStandardPotionPool(),
      currentItems: alchemistState.potions,
      count: ALCHEMIST_POTIONS_OFFERED,
      setRunGold: run.setRunGold,
      setState: setAlchemistState,
      mapState: (p, potions) => ({ ...p, potions, refreshesLeft: p.refreshesLeft - 1 }),
      deck: run.runDeck,
    });
  }

  function handleAlchemistMixPotions(indexA: number, indexB: number): BattleCard | null {
    const price = Math.max(0, ALCHEMIST_MIX_PRICE - talents.talentEffects.mixPotionDiscount);
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

  return {
    initShop: () => {
      shopDiscountConsumed.current = false;
      setShopState(createInitialShopState(run.runDeck));
    },
    initAlchemist: () => {
      alchemistDiscountConsumed.current = false;
      setAlchemistState(createInitialAlchemistState(run.runDeck));
    },
    handleShopBuyCard,
    handleShopRemoveCard,
    handleShopRefresh,
    handleAlchemistBuyCard,
    handleAlchemistRefresh,
    handleAlchemistMixPotions,
    get shopCards() {
      return readRunSessionStore().shopState.cards;
    },
    get alchemistPotions() {
      return alchemistState.potions;
    },
  };
}
