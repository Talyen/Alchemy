import { appendCardToRunWithDiscovery, discoverCardIds } from "@/features/alchemy/run-loop/run/deck-mutations";
import {
  createDraftRunRandomSource,
  deductGold,
  readDraftGold,
  setAlchemistState,
  setRunDeck,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { applyMixToDeck, tryCreateMixedPotion } from "@/lib/alchemist";
import { ALCHEMIST_POTIONS_OFFERED, MIXED_POTION_CARD_ID } from "@/lib/game-constants";
import { isStandardPotionCard, type BattleCard, type TalentEffectManifest } from "@/lib/game-data";
import { isValidDeckIndex } from "@/lib/utils";
import type { HomesteadEffectManifest } from "@/lib/homestead/types";
import { getStandardPotionPool } from "@/lib/game-data/cards/card-pools";
import { computeAlchemistPotionBuyPrice, computeAlchemistRefreshPrice, computeMixPotionPrice } from "./shop-pricing";
import { resolveDraftShopPricingContext, resolveReadShopPricingContext } from "./shop-pricing-context";
import {
  commitShopInitialize,
  mapRefreshedShopOfferings,
  runShopTransaction,
  purchaseShopOffering,
  refreshCardShopOfferings,
  type ShopTransactionResult,
} from "./shop-transactions";
import { shopArrayOfferingMatches } from "./shop-slot-keys";
import type { AlchemistShopCommands } from "./shop-action-types";
import { createInitialAlchemistState, type AlchemistState } from "./shop-state-init";

export function createAlchemistShopCommands({
  talentEffects,
  homesteadEffects,
}: {
  talentEffects: TalentEffectManifest;
  homesteadEffects: HomesteadEffectManifest;
}): AlchemistShopCommands {
  const getPotionBuyPrice = (card: BattleCard) => {
    return computeAlchemistPotionBuyPrice(card, resolveReadShopPricingContext(talentEffects, "alchemistState"));
  };
  const getMixPrice = () => computeMixPotionPrice(talentEffects);
  const getRefreshPrice = (refreshesLeft: number) => computeAlchemistRefreshPrice(talentEffects, refreshesLeft);

  function initialize(): void {
    commitShopInitialize(setAlchemistState, (draft) =>
      createInitialAlchemistState(draft.run.activeRun.runDeck, createDraftRunRandomSource(draft, "shops")),
    );
  }

  function buyPotion(card: BattleCard, slotKey: string): boolean {
    return runShopTransaction((draft) => {
      const state = draft.session.alchemistState;
      const price = computeAlchemistPotionBuyPrice(card, resolveDraftShopPricingContext(talentEffects, draft, state));
      return purchaseShopOffering({
        draft,
        price,
        state,
        setState: setAlchemistState,
        slotKey,
        offeringMatches: shopArrayOfferingMatches(state.potions, slotKey, card.id, (offered) => offered.id),
        acquire: () => appendCardToRunWithDiscovery(draft, card),
      });
    }).committed;
  }

  function mixPotions(indexA: number, indexB: number): BattleCard | null {
    const price = getMixPrice();
    return runShopTransaction((draft): ShopTransactionResult<BattleCard | null> => {
      const run = draft.run.activeRun;
      const state = draft.session.alchemistState;
      if (
        readDraftGold(draft) < price ||
        state.mixUsed ||
        indexA === indexB ||
        !isValidDeckIndex(indexA, run.runDeck.length) ||
        !isValidDeckIndex(indexB, run.runDeck.length)
      ) {
        return { committed: false, price, value: null };
      }

      const cardA = run.runDeck[indexA];
      const cardB = run.runDeck[indexB];
      if (!cardA || !cardB || !isStandardPotionCard(cardA) || !isStandardPotionCard(cardB)) {
        return { committed: false, price, value: null };
      }
      const mixed = tryCreateMixedPotion(
        cardA,
        cardB,
        talentEffects.potionMixPotency + homesteadEffects.potionMixPotency,
      );
      if (!mixed) {
        return { committed: false, price, value: null };
      }
      deductGold(draft, price);
      setAlchemistState(draft, (previous) => ({ ...previous, mixUsed: true }));
      setRunDeck(draft, (previous) => applyMixToDeck(previous, indexA, indexB, mixed));
      discoverCardIds(draft, [MIXED_POTION_CARD_ID]);
      return { committed: true, price, value: mixed };
    }).value;
  }

  function refresh(): boolean {
    return runShopTransaction((draft) => {
      const state = draft.session.alchemistState;
      return refreshCardShopOfferings<AlchemistState>({
        draft,
        price: getRefreshPrice(state.refreshesLeft),
        refreshesLeft: state.refreshesLeft,
        pool: getStandardPotionPool(),
        currentItems: state.potions,
        count: ALCHEMIST_POTIONS_OFFERED,
        setState: setAlchemistState,
        rng: createDraftRunRandomSource(draft, "shops"),
        mapState: (previous, potions) => mapRefreshedShopOfferings(previous, "potions", potions),
      });
    }).committed;
  }

  return { initialize, buyPotion, mixPotions, refresh, getPotionBuyPrice, getMixPrice, getRefreshPrice };
}
