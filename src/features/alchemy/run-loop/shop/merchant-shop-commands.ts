import { bindSessionCapabilities } from "@/features/alchemy/shared/stores/session-capabilities";
import { createShopInitializer } from "./shop-initialization";
import { appendCardToRunWithDiscovery } from "@/features/alchemy/shared/stores/deck-mutations";
import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { snapshotTransactionValue } from "@/features/alchemy/shared/stores/run-session-command";
import {
  createDraftRunRandomSource,
  setRunDeck,
  setShopState,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { readActivityData } from "@/lib/active-run-session";
import { SHOP_CARDS_OFFERED } from "@/lib/game-constants";
import { isValidDeckIndex } from "@/lib/utils";
import type { MerchantShopCommands } from "./shop-action-types";
import {
  cardSlotKeyOf,
  createGetRefreshPrice,
  createShopPurchaseActions,
  createShopRefreshAction,
} from "./shop-commands-core";
import { computeRemoveCardPrice, getShopBuyPrice } from "./shop-pricing";
import {
  resolveDraftShopEffects,
  resolveDraftShopModifiers,
  resolveReadShopEffects,
  resolveReadShopModifiers,
} from "./shop-pricing-context";
import { merchantShopPool, resampleCardShopOfferings } from "./shop-state-init";
import { commitShopService, runShopTransaction } from "./shop-transactions";

export function createMerchantShopCommands(gameSession: GameSession): MerchantShopCommands {
  const { buy: buyCard, getBuyPrice: getCardBuyPrice } = createShopPurchaseActions(
    {
      activity: "shop",
      itemsOf: (state) => state.cards,
      slotKeyOf: cardSlotKeyOf,
      idOf: (item) => item.id,
      priceOf: (card, context) => getShopBuyPrice("merchantCard", card, context),
      acquire: appendCardToRunWithDiscovery,
    },
    gameSession,
  );
  const getRemoveCardPrice = () => {
    const { talentEffects, homesteadEffects } = resolveReadShopEffects(gameSession);
    return computeRemoveCardPrice(
      talentEffects,
      resolveReadShopModifiers(gameSession),
      homesteadEffects.removeCardDiscount,
    );
  };
  const getRefreshPrice = createGetRefreshPrice("shop", gameSession);

  const initialize = createShopInitializer("merchant", gameSession);

  function removeCard(index: number): boolean {
    return runShopTransaction(
      "shop",
      (draft) => {
        const state = readActivityData(snapshotTransactionValue(draft.session.activity), "shop");
        const { talentEffects, homesteadEffects } = resolveDraftShopEffects(draft);
        const price = computeRemoveCardPrice(
          talentEffects,
          resolveDraftShopModifiers(draft),
          homesteadEffects.removeCardDiscount,
        );
        const run = draft.run.activeRun;
        return commitShopService({
          draft,
          price,
          guard: !state.removeUsed && isValidDeckIndex(index, run.runDeck.length),
          failureValue: undefined,
          apply: () => {
            setRunDeck(draft, (previous) => previous.filter((_, cardIndex) => cardIndex !== index));
            setShopState(draft, (previous) => ({ ...previous, removeUsed: true }));
            return undefined;
          },
        });
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
    initialize,
    buyCard,
    removeCard,
    refresh,
    getCardBuyPrice,
    getRemoveCardPrice,
    getRefreshPrice,
  });
}
