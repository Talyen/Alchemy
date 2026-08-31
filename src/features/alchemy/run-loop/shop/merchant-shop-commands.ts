import { appendCardToRunWithDiscovery } from "@/features/alchemy/run-loop/run/deck-mutations";
import {
  createDraftRunRandomSource,
  deductRunGold,
  readDraftGold,
  setRunDeck,
  setShopState,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { SHOP_CARDS_OFFERED } from "@/lib/game-constants";
import { getOfferableCardPool } from "@/lib/game-data/cards/card-pools";
import type { BattleCard, TalentEffectManifest } from "@/lib/game-data";
import { computeMerchantCardBuyPrice, computeMerchantRefreshPrice, computeRemoveCardPrice } from "./shop-pricing";
import { resolveDraftShopPricingContext, resolveReadShopPricingContext } from "./shop-pricing-context";
import {
  commitShopInitialize,
  mapRefreshedShopOfferings,
  runShopTransaction,
  purchaseShopOffering,
  refreshCardShopOfferings,
} from "./shop-transactions";
import { isValidDeckIndex } from "@/lib/utils";
import { shopArrayOfferingMatches } from "./shop-slot-keys";
import type { MerchantShopCommands } from "./shop-action-types";
import { createInitialShopState, type ShopState } from "./shop-state-init";

export function createMerchantShopCommands({
  talentEffects,
}: {
  talentEffects: TalentEffectManifest;
}): MerchantShopCommands {
  const getCardBuyPrice = (card: BattleCard) => {
    return computeMerchantCardBuyPrice(card, resolveReadShopPricingContext(talentEffects, "shopState"));
  };
  const getRemoveCardPrice = () => computeRemoveCardPrice(talentEffects);
  const getRefreshPrice = (refreshesLeft: number) => computeMerchantRefreshPrice(talentEffects, refreshesLeft);

  function initialize(): void {
    commitShopInitialize(setShopState, (draft) =>
      createInitialShopState(draft.run.activeRun.runDeck, createDraftRunRandomSource(draft, "shops")),
    );
  }

  function buyCard(card: BattleCard, slotKey: string): boolean {
    return runShopTransaction((draft) => {
      const state = draft.session.shopState;
      const price = computeMerchantCardBuyPrice(card, resolveDraftShopPricingContext(talentEffects, draft, state));
      return purchaseShopOffering({
        draft,
        price,
        state,
        setState: setShopState,
        slotKey,
        offeringMatches: shopArrayOfferingMatches(state.cards, slotKey, card.id, (offered) => offered.id),
        acquire: () => appendCardToRunWithDiscovery(draft, card),
      });
    }).committed;
  }

  function removeCard(index: number): boolean {
    const price = getRemoveCardPrice();
    return runShopTransaction((draft) => {
      const state = draft.session.shopState;
      const run = draft.run.activeRun;
      if (state.removeUsed || !isValidDeckIndex(index, run.runDeck.length) || readDraftGold(draft) < price) {
        return { committed: false, price, value: undefined };
      }
      deductRunGold(draft, price);
      setRunDeck(draft, (previous) => previous.filter((_, cardIndex) => cardIndex !== index));
      setShopState(draft, (previous) => ({ ...previous, removeUsed: true }));
      return { committed: true, price, value: undefined };
    }).committed;
  }

  function refresh(): boolean {
    return runShopTransaction((draft) => {
      const state = draft.session.shopState;
      return refreshCardShopOfferings<ShopState>({
        draft,
        price: getRefreshPrice(state.refreshesLeft),
        refreshesLeft: state.refreshesLeft,
        pool: getOfferableCardPool(),
        currentItems: state.cards,
        count: SHOP_CARDS_OFFERED,
        setState: setShopState,
        rng: createDraftRunRandomSource(draft, "shops"),
        mapState: (previous, cards) => mapRefreshedShopOfferings(previous, "cards", cards),
      });
    }).committed;
  }

  return { initialize, buyCard, removeCard, refresh, getCardBuyPrice, getRemoveCardPrice, getRefreshPrice };
}
