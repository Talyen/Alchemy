import { appendCardToRunWithDiscovery } from "@/features/alchemy/run-loop/run/deck-mutations";
import { spendRunGold } from "@/features/alchemy/run-loop/run-gold";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { readActiveRun, readRunSession } from "@/features/alchemy/shared/stores/run-session-read-port";
import {
  bindRunRandomSource,
  setRunDeck,
  setRunGold,
  setShopState,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { SHOP_CARDS_OFFERED } from "@/lib/game-constants";
import { getOfferableCardPool } from "@/lib/game-data/cards/card-pools";
import type { BattleCard, TalentEffectManifest } from "@/lib/game-data";
import { purchaseShopOffering, refreshCardShopOfferings, type ShopTransactionResult } from "../shop-transactions";
import type { MerchantShopCommands } from "./shop-action-types";
import { playShopSpendFeedback } from "./shop-feedback";
import {
  computeMerchantCardBuyPrice,
  computeMerchantRefreshPrice,
  computeRemoveCardPrice,
} from "./shop-price-selectors";
import { createInitialShopState, type ShopState } from "./shop-state-init";

export function createMerchantShopCommands({
  talentEffects,
  rng,
}: {
  talentEffects: TalentEffectManifest;
  rng: () => number;
}): MerchantShopCommands {
  const getCardBuyPrice = (card: BattleCard) =>
    computeMerchantCardBuyPrice(card, {
      talentEffects,
      runTrinkets: readActiveRun().runTrinkets,
      firstPurchaseUsed: readRunSession().shopState.firstPurchaseUsed,
    });
  const getRemoveCardPrice = () => computeRemoveCardPrice(talentEffects);
  const getRefreshPrice = (refreshesLeft: number) => computeMerchantRefreshPrice(talentEffects, refreshesLeft);

  function initialize(): void {
    dispatchRunSessionCommand((draft) =>
      setShopState(draft, createInitialShopState(draft.run.activeRun.runDeck, bindRunRandomSource(rng, draft))),
    );
  }

  function buyCard(card: BattleCard, slotKey: string): boolean {
    const result = dispatchRunSessionCommand((draft) => {
      const state = draft.session.shopState;
      const price = computeMerchantCardBuyPrice(card, {
        talentEffects,
        runTrinkets: draft.run.activeRun.runTrinkets,
        firstPurchaseUsed: state.firstPurchaseUsed,
      });
      return purchaseShopOffering({
        draft,
        price,
        state,
        setState: setShopState,
        slotKey,
        acquire: () => appendCardToRunWithDiscovery(card, setRunDeck, draft),
      });
    });
    playShopSpendFeedback(result);
    return result.committed;
  }

  function removeCard(index: number): boolean {
    const price = getRemoveCardPrice();
    const result = dispatchRunSessionCommand((draft): ShopTransactionResult => {
      const state = draft.session.shopState;
      const run = draft.run.activeRun;
      if (state.removeUsed || index < 0 || index >= run.runDeck.length || run.runGold < price) {
        return { committed: false, price, value: undefined };
      }
      spendRunGold(price, (update) => setRunGold(draft, update));
      setRunDeck(draft, (previous) => previous.filter((_, cardIndex) => cardIndex !== index));
      setShopState(draft, (previous) => ({ ...previous, removeUsed: true }));
      return { committed: true, price, value: undefined };
    });
    playShopSpendFeedback(result);
    return result.committed;
  }

  function refresh(): boolean {
    const result = dispatchRunSessionCommand((draft) => {
      const state = draft.session.shopState;
      return refreshCardShopOfferings<ShopState>({
        draft,
        price: getRefreshPrice(state.refreshesLeft),
        refreshesLeft: state.refreshesLeft,
        pool: getOfferableCardPool(),
        currentItems: state.cards,
        count: SHOP_CARDS_OFFERED,
        setState: setShopState,
        rng: bindRunRandomSource(rng, draft),
        mapState: (previous, cards) => ({
          ...previous,
          cards,
          refreshesLeft: previous.refreshesLeft - 1,
          purchasedSlotKeys: [],
        }),
      });
    });
    playShopSpendFeedback(result);
    return result.committed;
  }

  return { initialize, buyCard, removeCard, refresh, getCardBuyPrice, getRemoveCardPrice, getRefreshPrice };
}
