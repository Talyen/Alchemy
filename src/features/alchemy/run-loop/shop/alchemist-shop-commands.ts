import { appendCardToRunWithDiscovery } from "@/features/alchemy/shared/stores/deck-mutations";
import { defaultGameSession } from "@/features/alchemy/shared/stores/default-game-session";
import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { discoverCardIds } from "@/features/alchemy/shared/stores/profile-store";
import { snapshotTransactionValue } from "@/features/alchemy/shared/stores/run-session-command";
import {
  createDraftRunRandomSource,
  setAlchemistState,
  setRunDeck,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { readActivityData } from "@/lib/active-run-session";
import { applyMixToDeck, tryCreateMixedPotion } from "@/lib/alchemist";
import { strengthenPotion as prepareStrengthenedPotion } from "@/lib/alchemist/brewing";
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

export function createAlchemistShopCommands(
  {
    talentEffects,
    homesteadEffects,
  }: {
    talentEffects: TalentEffectManifest;
    homesteadEffects: Pick<HomesteadEffectManifest, "mixPotionDiscount">;
  },
  gameSession: GameSession = defaultGameSession,
): AlchemistShopCommands {
  const { buy: buyPotion, getBuyPrice: getPotionBuyPrice } = createShopPurchaseActions(
    {
      activity: "alchemist",
      talentEffects,
      itemsOf: (state) => state.potions,
      slotKeyOf: cardSlotKeyOf,
      idOf: (item) => item.id,
      priceOf: (card, context) => getShopBuyPrice("alchemistPotion", card, context),
      acquire: appendCardToRunWithDiscovery,
    },
    gameSession,
  );
  const getMixPrice = () =>
    computeMixPotionPrice(talentEffects, resolveReadShopModifiers(gameSession), homesteadEffects.mixPotionDiscount);
  const getRefreshPrice = createGetRefreshPrice("alchemist", talentEffects, gameSession);

  const initialize = initializeShop(
    "alchemist",
    (draft) =>
      createInitialAlchemistState(
        snapshotTransactionValue(draft.run.activeRun.runDeck),
        createDraftRunRandomSource(draft, "shops"),
        resolveDraftShopModifiers(draft),
      ),
    gameSession,
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
          const state = readActivityData(snapshotTransactionValue(draft.session.activity), "alchemist");
          const prepared = state.mixUsed ? null : prepare(snapshotTransactionValue(draft.run.activeRun.runDeck));
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
        gameSession,
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

  const refresh = createShopRefreshAction(
    {
      activity: "alchemist",
      talentEffects,
      resample: (draft, state, modifiers) => ({
        ...state,
        potions: applyStrongSpiritsToPotions(
          resampleCardShopOfferings(
            snapshotTransactionValue(draft.run.activeRun.runDeck),
            getStandardPotionPool(),
            state.potions,
            ALCHEMIST_POTIONS_OFFERED,
            createDraftRunRandomSource(draft, "shops"),
          ),
          modifiers,
        ),
      }),
    },
    gameSession,
  );

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
