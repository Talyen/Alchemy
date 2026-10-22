import { bindSessionCapabilities } from "@/features/alchemy/shared/stores/session/session-capabilities";
import { appendCardToRunWithDiscovery } from "@/features/alchemy/shared/stores/commands/deck-mutations";
import { type GameSession } from "@/features/alchemy/shared/stores/session/game-session-types";
import { snapshotTransactionValue } from "@/features/alchemy/shared/stores/commands/run-session-command";
import {
  createDraftRunRandomSource,
  deductGold,
  readDraftGold,
  setRunDeck,
  setShopState,
} from "@/features/alchemy/shared/stores/commands/run-session-write-port";
import { readActivityData } from "@/lib/active-run-session";
import { SHOP_CARDS_OFFERED } from "@/lib/game-constants";
import { isValidDeckIndex } from "@/lib/utils";
import {
  cardSlotKeyOf,
  createGetRefreshPrice,
  createShopPurchaseActions,
  createShopRefreshAction,
} from "./shop-commands-core";
import { computeRemoveCardPrice, draftShopDiscounts, getShopBuyPrice, readShopDiscounts } from "./shop-pricing";
import { merchantShopPool, resampleCardShopOfferings } from "./shop-state-init";
import { runShopTransaction } from "./shop-transactions";

export function createMerchantShopCommands(gameSession: GameSession) {
  const { buy: buyCard, getBuyPrice: getCardBuyPrice } = createShopPurchaseActions(
    {
      activity: "shop",
      itemsOf: (state) => state.cards,
      slotKeyOf: cardSlotKeyOf,
      priceOf: (card, context) => getShopBuyPrice({ kind: "merchantCard", item: card, context }),
      acquire: appendCardToRunWithDiscovery,
    },
    gameSession,
  );
  const getRemoveCardPrice = () => {
    const { talentEffects, homesteadEffects, modifiers } = readShopDiscounts(gameSession);
    return computeRemoveCardPrice(talentEffects, modifiers, homesteadEffects.removeCardDiscount);
  };
  const getRefreshPrice = createGetRefreshPrice("shop", gameSession);

  function removeCard(index: number): boolean {
    return runShopTransaction(
      "shop",
      (draft) => {
        const state = readActivityData(snapshotTransactionValue(draft.session.activity), "shop");
        const { talentEffects, homesteadEffects, modifiers } = draftShopDiscounts(draft);
        const price = computeRemoveCardPrice(talentEffects, modifiers, homesteadEffects.removeCardDiscount);
        const run = draft.run.activeRun;
        if (state.removeUsed || !isValidDeckIndex(index, run.runDeck.length) || readDraftGold(draft) < price) {
          return { committed: false, price, value: null };
        }
        deductGold(draft, price);
        setRunDeck(draft, (previous) => previous.filter((_, cardIndex) => cardIndex !== index));
        setShopState(draft, (previous) => ({ ...previous, removeUsed: true }));
        return { committed: true, price, value: null };
      },
      "shopRemove",
      gameSession,
    ).committed;
  }

  const refresh = createShopRefreshAction(
    {
      activity: "shop",
      resample: (draft, state, modifiers) => ({
        ...state,
        cards: resampleCardShopOfferings(
          snapshotTransactionValue(draft.run.activeRun.runDeck),
          merchantShopPool(modifiers),
          state.cards,
          SHOP_CARDS_OFFERED,
          createDraftRunRandomSource(draft, "shops"),
        ),
      }),
    },
    gameSession,
  );

  return bindSessionCapabilities(gameSession, {
    buyCard,
    removeCard,
    refresh,
    getCardBuyPrice,
    getRemoveCardPrice,
    getRefreshPrice,
  });
}
