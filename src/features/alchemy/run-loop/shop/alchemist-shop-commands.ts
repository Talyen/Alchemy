import { appendCardToRunWithDiscovery } from "@/features/alchemy/shared/stores/deck-mutations";
import { discoverCardIds } from "@/features/alchemy/shared/stores/profile-store";
import {
  createDraftRunRandomSource,
  setAlchemistState,
  setRunDeck,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { applyMixToDeck, tryCreateMixedPotion } from "@/lib/alchemist";
import { ALCHEMIST_POTIONS_OFFERED, MIXED_POTION_CARD_ID } from "@/lib/game-constants";
import { isStandardPotionCard, type BattleCard, type TalentEffectManifest } from "@/lib/game-data";
import { isValidDeckIndex } from "@/lib/utils";
import type { HomesteadEffectManifest } from "@/lib/homestead/types";
import { getStandardPotionPool } from "@/lib/game-data/cards/card-pools";
import { computeMixPotionPrice, getShopBuyPrice, getShopRefreshPrice } from "./shop-pricing";
import {
  resolveDraftShopModifiers,
  resolveReadShopModifiers,
  resolveReadShopPricingContext,
} from "./shop-pricing-context";
import {
  commitShopService,
  refreshShopOfferings,
  runShopTransaction,
  type ShopTransactionResult,
} from "./shop-transactions";
import type { AlchemistShopCommands } from "./shop-action-types";
import { cardSlotKeyOf, initializeShop, purchaseSlotOffering } from "./shop-commands-core";
import { applyStrongSpiritsToPotions, createInitialAlchemistState, resampleCardShopOfferings } from "./shop-state-init";

export function createAlchemistShopCommands({
  talentEffects,
  homesteadEffects,
}: {
  talentEffects: TalentEffectManifest;
  homesteadEffects: Pick<HomesteadEffectManifest, "potionMixPotency">;
}): AlchemistShopCommands {
  const getPotionBuyPrice = (card: BattleCard) => {
    return getShopBuyPrice("alchemistPotion", card, resolveReadShopPricingContext(talentEffects, "alchemistState"));
  };
  const getMixPrice = () => computeMixPotionPrice(talentEffects, resolveReadShopModifiers());
  const getRefreshPrice = (refreshesLeft: number, modifiers = resolveReadShopModifiers()) =>
    getShopRefreshPrice("alchemist", talentEffects, refreshesLeft, modifiers);

  const initialize = initializeShop(setAlchemistState, (draft) =>
    createInitialAlchemistState(
      draft.run.activeRun.runDeck,
      createDraftRunRandomSource(draft, "shops"),
      resolveDraftShopModifiers(draft),
    ),
  );

  function buyPotion(card: BattleCard, slotKey: string): boolean {
    return runShopTransaction((draft) => {
      const state = draft.session.alchemistState;
      return purchaseSlotOffering({
        talentEffects,
        state,
        setState: setAlchemistState,
        draft,
        items: state.potions,
        requestedId: card.id,
        slotKey,
        buyKind: "alchemistPotion",
        slotKeyOf: cardSlotKeyOf,
        idOf: (item) => item.id,
        acquire: (innerDraft, offered) => appendCardToRunWithDiscovery(innerDraft, offered),
      });
    }).committed;
  }

  function mixPotions(indexA: number, indexB: number): BattleCard | null {
    return runShopTransaction((draft): ShopTransactionResult<BattleCard | null> => {
      const run = draft.run.activeRun;
      const state = draft.session.alchemistState;
      const price = computeMixPotionPrice(talentEffects, resolveDraftShopModifiers(draft));
      const cardA = run.runDeck[indexA];
      const cardB = run.runDeck[indexB];
      const mixed =
        cardA && cardB && isStandardPotionCard(cardA) && isStandardPotionCard(cardB)
          ? tryCreateMixedPotion(cardA, cardB, talentEffects.potionMixPotency + homesteadEffects.potionMixPotency)
          : null;
      return commitShopService({
        draft,
        price,
        guard:
          !state.mixUsed &&
          indexA !== indexB &&
          isValidDeckIndex(indexA, run.runDeck.length) &&
          isValidDeckIndex(indexB, run.runDeck.length) &&
          mixed !== null,
        failureValue: null,
        apply: () => {
          setAlchemistState(draft, (previous) => ({ ...previous, mixUsed: true }));
          setRunDeck(draft, (previous) => applyMixToDeck(previous, indexA, indexB, mixed as BattleCard));
          discoverCardIds(draft, [MIXED_POTION_CARD_ID]);
          return mixed;
        },
      });
    }).value;
  }

  function refresh(): boolean {
    return runShopTransaction((draft) => {
      const state = draft.session.alchemistState;
      const modifiers = resolveDraftShopModifiers(draft);
      return refreshShopOfferings({
        draft,
        price: getShopRefreshPrice("alchemist", talentEffects, state.refreshesLeft, modifiers),
        refreshesLeft: state.refreshesLeft,
        setState: setAlchemistState,
        mapState: (previous, items) => ({ ...previous, potions: items }),
        resample: () =>
          applyStrongSpiritsToPotions(
            resampleCardShopOfferings(
              draft.run.activeRun.runDeck,
              getStandardPotionPool(),
              state.potions,
              ALCHEMIST_POTIONS_OFFERED,
              createDraftRunRandomSource(draft, "shops"),
            ),
            modifiers,
          ),
      });
    }).committed;
  }

  return { initialize, buyPotion, mixPotions, refresh, getPotionBuyPrice, getMixPrice, getRefreshPrice };
}
