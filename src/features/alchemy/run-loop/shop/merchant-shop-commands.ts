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
import type { TalentEffectManifest } from "@/lib/game-data";
import type { HomesteadEffectManifest } from "@/lib/homestead/types";
import { isValidDeckIndex } from "@/lib/utils";
import type { MerchantShopCommands } from "./shop-action-types";
import {
  cardSlotKeyOf,
  createGetRefreshPrice,
  createShopPurchaseActions,
  createShopRefreshAction,
} from "./shop-commands-core";
import { computeRemoveCardPrice, getShopBuyPrice } from "./shop-pricing";
import { resolveDraftShopModifiers, resolveReadShopModifiers } from "./shop-pricing-context";
import { merchantShopPool, resampleCardShopOfferings } from "./shop-state-init";
import { commitShopService, runShopTransaction } from "./shop-transactions";

export function createMerchantShopCommands(
  {
    talentEffects,
    homesteadEffects,
  }: {
    talentEffects: TalentEffectManifest;
    homesteadEffects: Pick<HomesteadEffectManifest, "removeCardDiscount">;
  },
  gameSession: GameSession,
): MerchantShopCommands {
  const { buy: buyCard, getBuyPrice: getCardBuyPrice } = createShopPurchaseActions(
    {
      activity: "shop",
      talentEffects,
      itemsOf: (state) => state.cards,
      slotKeyOf: cardSlotKeyOf,
      idOf: (item) => item.id,
      priceOf: (card, context) => getShopBuyPrice("merchantCard", card, context),
      acquire: appendCardToRunWithDiscovery,
    },
    gameSession,
  );
  const getRemoveCardPrice = () =>
    computeRemoveCardPrice(talentEffects, resolveReadShopModifiers(gameSession), homesteadEffects.removeCardDiscount);
  const getRefreshPrice = createGetRefreshPrice("shop", talentEffects, gameSession);

  const initialize = createShopInitializer("merchant", gameSession);

  function removeCard(index: number): boolean {
    return runShopTransaction(
      "shop",
      (draft) => {
        const state = readActivityData(snapshotTransactionValue(draft.session.activity), "shop");
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
      talentEffects,
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
