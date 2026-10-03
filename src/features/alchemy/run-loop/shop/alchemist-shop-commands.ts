import { appendCardToRunWithDiscovery } from "@/features/alchemy/shared/stores/deck-mutations";
import { discoverCardIds } from "@/features/alchemy/shared/stores/profile-store";
import {
  createDraftRunRandomSource,
  setAlchemistState,
  setRunDeck,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { readActivityData } from "@/lib/active-run-session";
import { strengthenPotion as prepareStrengthenedPotion } from "@/lib/alchemist/brewing";
import { applyMixToDeck, tryCreateMixedPotion } from "@/lib/alchemist";
import { ALCHEMIST_POTIONS_OFFERED, MIXED_POTION_CARD_ID } from "@/lib/game-constants";
import { isMixedPotionCard, isStandardPotionCard, type BattleCard, type TalentEffectManifest } from "@/lib/game-data";
import { getStandardPotionPool } from "@/lib/game-data/cards/card-pools";
import type { HomesteadEffectManifest } from "@/lib/homestead/types";
import { isValidDeckIndex } from "@/lib/utils";
import type { AlchemistShopCommands } from "./shop-action-types";
import {
  cardSlotKeyOf,
  createGetRefreshPrice,
  createShopPurchaseActions,
  createShopRefreshAction,
  initializeShop,
} from "./shop-commands-core";
import { computeMixPotionPrice, getShopBuyPrice } from "./shop-pricing";
import { resolveDraftShopModifiers, resolveReadShopModifiers } from "./shop-pricing-context";
import { applyStrongSpiritsToPotions, createInitialAlchemistState, resampleCardShopOfferings } from "./shop-state-init";
import { commitShopService, runShopTransaction } from "./shop-transactions";

export function createAlchemistShopCommands({
  talentEffects,
  homesteadEffects,
}: {
  talentEffects: TalentEffectManifest;
  homesteadEffects: Pick<HomesteadEffectManifest, "mixPotionDiscount">;
}): AlchemistShopCommands {
  const { buy: buyPotion, getBuyPrice: getPotionBuyPrice } = createShopPurchaseActions({
    activity: "alchemist",
    talentEffects,
    itemsOf: (state) => state.potions,
    slotKeyOf: cardSlotKeyOf,
    idOf: (item) => item.id,
    priceOf: (card, context) => getShopBuyPrice("alchemistPotion", card, context),
    acquire: appendCardToRunWithDiscovery,
  });
  const getMixPrice = () =>
    computeMixPotionPrice(talentEffects, resolveReadShopModifiers(), homesteadEffects.mixPotionDiscount);
  const getRefreshPrice = createGetRefreshPrice("alchemist", talentEffects);

  const initialize = initializeShop("alchemist", (draft) =>
    createInitialAlchemistState(
      draft.run.activeRun.runDeck,
      createDraftRunRandomSource(draft, "shops"),
      resolveDraftShopModifiers(draft),
    ),
  );

  function brewPotion(
    prepare: (deck: BattleCard[]) => { potion: BattleCard; deck: BattleCard[] } | null,
  ): BattleCard | null {
    return (
      runShopTransaction(
        "alchemist",
        (draft) => {
          const price = computeMixPotionPrice(
            talentEffects,
            resolveDraftShopModifiers(draft),
            homesteadEffects.mixPotionDiscount,
          );
          const state = readActivityData(draft.session.activity, "alchemist");
          const prepared = state.mixUsed ? null : prepare(draft.run.activeRun.runDeck);
          return commitShopService({
            draft,
            price,
            guard: prepared !== null,
            failureValue: null,
            apply: () => {
              if (!prepared) return null;
              setAlchemistState(draft, (previous) => ({ ...previous, mixUsed: true }));
              setRunDeck(draft, prepared.deck);
              if (isMixedPotionCard(prepared.potion)) {
                discoverCardIds(draft, [MIXED_POTION_CARD_ID]);
              }
              return prepared.potion;
            },
          });
        },
        "alchemistMix",
      ).value ?? null
    );
  }

  function mixPotions(indexA: number, indexB: number): BattleCard | null {
    return brewPotion((deck) => {
      if (indexA === indexB || !isValidDeckIndex(indexA, deck.length) || !isValidDeckIndex(indexB, deck.length)) {
        return null;
      }
      const cardA = deck[indexA]!;
      const cardB = deck[indexB]!;
      if (!isStandardPotionCard(cardA) || !isStandardPotionCard(cardB)) return null;
      const potion = tryCreateMixedPotion(cardA, cardB, talentEffects.potionMixPotency);
      return potion ? { potion, deck: applyMixToDeck(deck, indexA, indexB, potion) } : null;
    });
  }

  function strengthenPotion(index: number): BattleCard | null {
    return brewPotion((deck) => {
      if (!isValidDeckIndex(index, deck.length)) return null;
      const potion = prepareStrengthenedPotion(deck[index]!);
      return potion ? { potion, deck: deck.map((card, i) => (i === index ? potion : card)) } : null;
    });
  }

  const refresh = createShopRefreshAction({
    activity: "alchemist",
    talentEffects,
    resample: (draft, state, modifiers) => ({
      ...state,
      potions: applyStrongSpiritsToPotions(
        resampleCardShopOfferings(
          draft.run.activeRun.runDeck,
          getStandardPotionPool(),
          state.potions,
          ALCHEMIST_POTIONS_OFFERED,
          createDraftRunRandomSource(draft, "shops"),
        ),
        modifiers,
      ),
    }),
  });

  return {
    initialize,
    buyPotion,
    mixPotions,
    strengthenPotion,
    refresh,
    getPotionBuyPrice,
    getMixPrice,
    getRefreshPrice,
  };
}
