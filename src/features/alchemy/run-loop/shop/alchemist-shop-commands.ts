import { bindSessionCapabilities } from "@/features/alchemy/shared/stores/session/session-capabilities";
import { appendCardToRunWithDiscovery } from "@/features/alchemy/shared/stores/commands/deck-mutations";
import { type GameSession } from "@/features/alchemy/shared/stores/session/game-session-types";
import { discoverCardIds } from "@/features/alchemy/shared/stores/session/profile-store";
import { snapshotTransactionValue } from "@/features/alchemy/shared/stores/commands/run-session-command";
import {
  createDraftRunRandomSource,
  deductGold,
  readDraftGold,
  setAlchemistState,
  setRunDeck,
} from "@/features/alchemy/shared/stores/commands/run-session-write-port";
import { type AlchemistState } from "@/lib/active-run-session/shop-session-types";
import { readActivityData } from "@/lib/active-run-session";
import { tryMixPotionDeck } from "@/lib/alchemist";
import { strengthenPotion as prepareStrengthenedPotion } from "@/lib/alchemist/brewing";
import { ALCHEMIST_POTIONS_OFFERED, MIXED_POTION_CARD_ID } from "@/lib/game-constants";
import {
  cloneBattleCard,
  getStandardPotionPoolView,
  isMixedPotionCard,
  isPotionCard,
  type BattleCard,
} from "@/lib/game-data";
import { isValidDeckIndex } from "@/lib/utils";
import {
  runShopTransaction,
  cardSlotKeyOf,
  createGetRefreshPrice,
  createShopPurchaseActions,
  createShopRefreshAction,
} from "./shop-commands-core";
import { computeMixPotionPrice, draftShopDiscounts, getShopBuyPrice, readShopDiscounts } from "./shop-pricing";
import { applyStrongSpiritsToPotions, resampleCardShopOfferings } from "./shop-state-init";

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

  function preparePotion(
    service: "brewUsed" | "mixUsed" | "distillUsed",
    prepare: (deck: BattleCard[], state: AlchemistState) => { potion: BattleCard; deck: BattleCard[] } | null,
  ): BattleCard | null {
    return runShopTransaction(
      "alchemist",
      (draft) => {
        const { talentEffects, homesteadEffects, modifiers } = draftShopDiscounts(draft);
        const price = computeMixPotionPrice(talentEffects, modifiers, homesteadEffects.mixPotionDiscount);
        const state = readActivityData(snapshotTransactionValue(draft.session.activity), "alchemist");
        if (state[service] || readDraftGold(draft) < price) return { committed: false, price, value: null };
        const prepared = prepare(snapshotTransactionValue(draft.run.activeRun.runDeck), state);
        if (!prepared) return { committed: false, price, value: null };
        deductGold(draft, price);
        setAlchemistState(draft, (previous) => ({ ...previous, [service]: true }));
        setRunDeck(draft, prepared.deck);
        if (isMixedPotionCard(prepared.potion)) {
          discoverCardIds(draft, [MIXED_POTION_CARD_ID]);
        } else {
          discoverCardIds(draft, [prepared.potion.id]);
        }
        return { committed: true, price, value: prepared.potion };
      },
      "alchemistMix",
      gameSession,
    ).value;
  }

  function brewPotion(offerIndex: number): BattleCard | null {
    return preparePotion("brewUsed", (deck, state) => {
      if (!isValidDeckIndex(offerIndex, state.brewOffers.length)) return null;
      const offer = state.brewOffers[offerIndex];
      if (!offer || !isPotionCard(offer)) return null;
      const potion = cloneBattleCard(offer);
      return { potion, deck: [...deck, potion] };
    });
  }

  function mixPotions(indexA: number, indexB: number): BattleCard | null {
    return preparePotion("mixUsed", (deck) => tryMixPotionDeck(deck, indexA, indexB));
  }

  function strengthenPotion(index: number): BattleCard | null {
    return preparePotion("distillUsed", (deck) => {
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
            getStandardPotionPoolView(),
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
    brewPotion,
    mixPotions,
    strengthenPotion,
    refresh,
    getPotionBuyPrice,
    getMixPrice,
    getRefreshPrice,
  });
}
