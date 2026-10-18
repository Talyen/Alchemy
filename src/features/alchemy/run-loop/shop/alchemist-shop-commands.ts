import { bindSessionCapabilities } from "@/features/alchemy/shared/stores/session-capabilities";
import { appendCardToRunWithDiscovery } from "@/features/alchemy/shared/stores/deck-mutations";
import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { discoverCardIds } from "@/features/alchemy/shared/stores/profile-store";
import { snapshotTransactionValue } from "@/features/alchemy/shared/stores/run-session-command";
import {
  createDraftRunRandomSource,
  deductGold,
  readDraftGold,
  setAlchemistState,
  setRunDeck,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { readActivityData } from "@/lib/active-run-session";
import { applyMixToDeck, tryCreateMixedPotion } from "@/lib/alchemist";
import { strengthenPotion as prepareStrengthenedPotion } from "@/lib/alchemist/brewing";
import { ALCHEMIST_POTIONS_OFFERED, MIXED_POTION_CARD_ID } from "@/lib/game-constants";
import { isMixedPotionCard, type BattleCard } from "@/lib/game-data";
import { getStandardPotionPool, isPotionCard } from "@/lib/game-data/cards/card-pools";
import { isValidDeckIndex } from "@/lib/utils";
import {
  cardSlotKeyOf,
  createGetRefreshPrice,
  createShopPurchaseActions,
  createShopRefreshAction,
} from "./shop-commands-core";
import { computeMixPotionPrice, draftShopDiscounts, getShopBuyPrice, readShopDiscounts } from "./shop-pricing";
import { applyStrongSpiritsToPotions, resampleCardShopOfferings } from "./shop-state-init";
import { runShopTransaction } from "./shop-transactions";

export function createAlchemistShopCommands(gameSession: GameSession) {
  const { buy: buyPotion, getBuyPrice: getPotionBuyPrice } = createShopPurchaseActions(
    {
      activity: "alchemist",
      itemsOf: (state) => state.potions,
      slotKeyOf: cardSlotKeyOf,
      priceOf: (card, context) => getShopBuyPrice({ kind: "alchemistPotion", item: card, context }),
      acquire: appendCardToRunWithDiscovery,
    },
    gameSession,
  );
  const getMixPrice = () => {
    const { talentEffects, homesteadEffects, modifiers } = readShopDiscounts(gameSession);
    return computeMixPotionPrice(talentEffects, modifiers, homesteadEffects.mixPotionDiscount);
  };
  const getRefreshPrice = createGetRefreshPrice("alchemist", gameSession);

  function brewPotion(
    prepare: (deck: BattleCard[]) => { potion: BattleCard; deck: BattleCard[] } | null,
  ): BattleCard | null {
    return runShopTransaction(
      "alchemist",
      (draft) => {
        const { talentEffects, homesteadEffects, modifiers } = draftShopDiscounts(draft);
        const price = computeMixPotionPrice(talentEffects, modifiers, homesteadEffects.mixPotionDiscount);
        const state = readActivityData(snapshotTransactionValue(draft.session.activity), "alchemist");
        if (state.mixUsed || readDraftGold(draft) < price) return { committed: false, price, value: null };
        const prepared = prepare(snapshotTransactionValue(draft.run.activeRun.runDeck));
        if (!prepared) return { committed: false, price, value: null };
        deductGold(draft, price);
        setAlchemistState(draft, (previous) => ({ ...previous, mixUsed: true }));
        setRunDeck(draft, prepared.deck);
        if (isMixedPotionCard(prepared.potion)) {
          discoverCardIds(draft, [MIXED_POTION_CARD_ID]);
        }
        return { committed: true, price, value: prepared.potion };
      },
      "alchemistMix",
      gameSession,
    ).value;
  }

  function mixPotions(indexA: number, indexB: number): BattleCard | null {
    return brewPotion((deck) => {
      if (indexA === indexB || !isValidDeckIndex(indexA, deck.length) || !isValidDeckIndex(indexB, deck.length)) {
        return null;
      }
      const cardA = deck[indexA];
      const cardB = deck[indexB];
      if (!cardA || !cardB || !isPotionCard(cardA) || !isPotionCard(cardB)) return null;
      const potion = tryCreateMixedPotion(cardA, cardB);
      return potion ? { potion, deck: applyMixToDeck(deck, indexA, indexB, potion) } : null;
    });
  }

  function strengthenPotion(index: number): BattleCard | null {
    return brewPotion((deck) => {
      const target = deck[index];
      if (!target || !isValidDeckIndex(index, deck.length)) return null;
      const potion = prepareStrengthenedPotion(target);
      return potion ? { potion, deck: deck.map((card, i) => (i === index ? potion : card)) } : null;
    });
  }

  const refresh = createShopRefreshAction(
    {
      activity: "alchemist",
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

  return bindSessionCapabilities(gameSession, {
    buyPotion,
    mixPotions,
    strengthenPotion,
    refresh,
    getPotionBuyPrice,
    getMixPrice,
    getRefreshPrice,
  });
}
