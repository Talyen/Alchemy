import { appendCardToRunWithDiscovery } from "@/features/alchemy/shared/stores/deck-mutations";
import {
  createDraftRunRandomSource,
  setRunDeck,
  setShopState,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { SHOP_CARDS_OFFERED } from "@/lib/game-constants";
import type { BattleCard, TalentEffectManifest } from "@/lib/game-data";
import { computeRemoveCardPrice } from "./shop-pricing";
import { resolveDraftShopModifiers, resolveReadShopModifiers } from "./shop-pricing-context";
import { commitShopService, runShopTransaction } from "./shop-transactions";
import { isValidDeckIndex } from "@/lib/utils";
import type { MerchantShopCommands } from "./shop-action-types";
import {
  cardSlotKeyOf,
  initializeShop,
  purchaseSlotOffering,
  readBuyPrices,
  readRefreshPrice,
  refreshCardOfferings,
} from "./shop-commands-core";
import { createInitialShopState, merchantShopPool, type ShopState } from "./shop-state-init";

export function createMerchantShopCommands({
  talentEffects,
}: {
  talentEffects: TalentEffectManifest;
}): MerchantShopCommands {
  const getCardBuyPrice = (card: BattleCard) => {
    return readBuyPrices("merchantCard", [card], talentEffects, "shopState")[0] ?? 0;
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
    return runShopTransaction((draft) => {
      const state = draft.session.shopState;
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
    return runShopTransaction((draft) => {
      const state = draft.session.shopState;
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
    }).committed;
  }

  function refresh(): boolean {
    return runShopTransaction((draft) => {
      const state = draft.session.shopState;
      return refreshCardOfferings<ShopState>({
        talentEffects,
        draft,
        state,
        setState: setShopState,
        itemsKey: "cards",
        pool: merchantShopPool(resolveDraftShopModifiers(draft)),
        currentItems: state.cards,
        count: SHOP_CARDS_OFFERED,
        rng: createDraftRunRandomSource(draft, "shops"),
        refreshKind: "merchant",
      });
    }).committed;
  }

  return { initialize, buyCard, removeCard, refresh, getCardBuyPrice, getRemoveCardPrice, getRefreshPrice };
}
