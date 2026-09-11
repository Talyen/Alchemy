import { appendCardToRunWithDiscovery } from "@/features/alchemy/shared/stores/deck-mutations";
import {
  createDraftRunRandomSource,
  setRunDeck,
  setShopState,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { readActivityData } from "@/lib/active-run-session";
import { SHOP_CARDS_OFFERED } from "@/lib/game-constants";
import type { BattleCard, TalentEffectManifest } from "@/lib/game-data";
import { isValidDeckIndex } from "@/lib/utils";
import type { MerchantShopCommands } from "./shop-action-types";
import { cardSlotKeyOf, initializeShop, purchaseSlotOffering, readRefreshPrice } from "./shop-commands-core";
import { computeRemoveCardPrice, getShopBuyPrice, getShopRefreshPrice } from "./shop-pricing";
import {
  resolveDraftShopModifiers,
  resolveReadShopModifiers,
  resolveReadShopPricingContext,
} from "./shop-pricing-context";
import { createInitialShopState, merchantShopPool, resampleCardShopOfferings } from "./shop-state-init";
import { commitShopService, refreshShopOfferings, runShopTransaction } from "./shop-transactions";

export function createMerchantShopCommands({
  talentEffects,
}: {
  talentEffects: TalentEffectManifest;
}): MerchantShopCommands {
  const getCardBuyPrice = (card: BattleCard) => {
    return getShopBuyPrice("merchantCard", card, resolveReadShopPricingContext(talentEffects, "shopState"));
  };
  const getRemoveCardPrice = () => computeRemoveCardPrice(talentEffects, resolveReadShopModifiers());
  const getRefreshPrice = (refreshesLeft: number) => readRefreshPrice("merchant", talentEffects, refreshesLeft);

  const initialize = initializeShop(setShopState, (draft) =>
    createInitialShopState(
      draft.run.activeRun.runDeck,
      createDraftRunRandomSource(draft, "shops"),
      resolveDraftShopModifiers(draft),
    ),
  );

  function buyCard(card: BattleCard, slotKey: string): boolean {
    return runShopTransaction("shop", (draft) => {
      const state = readActivityData(draft.session.activity, "shop");
      return purchaseSlotOffering({
        talentEffects,
        state,
        setState: setShopState,
        draft,
        items: state.cards,
        requestedId: card.id,
        slotKey,
        buyKind: "merchantCard",
        slotKeyOf: cardSlotKeyOf,
        idOf: (item) => item.id,
        acquire: (innerDraft, offered) => appendCardToRunWithDiscovery(innerDraft, offered),
      });
    }).committed;
  }

  function removeCard(index: number): boolean {
    return runShopTransaction(
      "shop",
      (draft) => {
        const state = readActivityData(draft.session.activity, "shop");
        const price = computeRemoveCardPrice(talentEffects, resolveDraftShopModifiers(draft));
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
    ).committed;
  }

  function refresh(): boolean {
    return runShopTransaction(
      "shop",
      (draft) => {
        const state = readActivityData(draft.session.activity, "shop");
        return refreshShopOfferings({
          draft,
          price: getShopRefreshPrice("merchant", talentEffects, state.refreshesLeft, resolveDraftShopModifiers(draft)),
          refreshesLeft: state.refreshesLeft,
          setState: setShopState,
          mapState: (previous, items) => ({ ...previous, cards: items }),
          resample: () =>
            resampleCardShopOfferings(
              draft.run.activeRun.runDeck,
              merchantShopPool(resolveDraftShopModifiers(draft)),
              state.cards,
              SHOP_CARDS_OFFERED,
              createDraftRunRandomSource(draft, "shops"),
            ),
        });
      },
      "shopRefresh",
    ).committed;
  }

  return { initialize, buyCard, removeCard, refresh, getCardBuyPrice, getRemoveCardPrice, getRefreshPrice };
}
