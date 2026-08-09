import { appendUnique } from "@/lib/utils";
import { appendCardToRunWithDiscovery } from "@/features/alchemy/run-loop/run/deck-mutations";
import { spendRunGold } from "@/features/alchemy/run-loop/run-gold";
import { setDiscoveredCardIds } from "@/features/alchemy/shared/stores/profile-store";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { readActiveRun, readRunSession } from "@/features/alchemy/shared/stores/run-session-read-port";
import {
  createDraftRunRandomSource,
  setAlchemistState,
  setRunDeck,
  setRunGold,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { applyMixToDeck, tryCreateMixedPotion } from "@/lib/alchemist";
import { ALCHEMIST_POTIONS_OFFERED, MIXED_POTION_CARD_ID } from "@/lib/game-constants";
import type { BattleCard, TalentEffectManifest } from "@/lib/game-data";
import { getStandardPotionPool } from "@/lib/game-data/cards/card-pools";
import { computeAlchemistPotionBuyPrice, computeAlchemistRefreshPrice, computeMixPotionPrice } from "./shop-pricing";
import {
  playShopSpendFeedback,
  purchaseShopOffering,
  refreshCardShopOfferings,
  type ShopTransactionResult,
} from "./shop-transactions";
import type { AlchemistShopCommands } from "./shop-action-types";
import { createInitialAlchemistState, type AlchemistState } from "./shop-state-init";

export function createAlchemistShopCommands({
  talentEffects,
}: {
  talentEffects: TalentEffectManifest;
}): AlchemistShopCommands {
  const getPotionBuyPrice = (card: BattleCard) =>
    computeAlchemistPotionBuyPrice(card, {
      talentEffects,
      runTrinkets: readActiveRun().runTrinkets,
      firstPurchaseUsed: readRunSession().alchemistState.firstPurchaseUsed,
    });
  const getMixPrice = () => computeMixPotionPrice(talentEffects);
  const getRefreshPrice = (refreshesLeft: number) => computeAlchemistRefreshPrice(talentEffects, refreshesLeft);

  function initialize(): void {
    dispatchRunSessionCommand((draft) =>
      setAlchemistState(
        draft,
        createInitialAlchemistState(draft.run.activeRun.runDeck, createDraftRunRandomSource(draft, "shops")),
      ),
    );
  }

  function buyPotion(card: BattleCard, slotKey: string): boolean {
    const result = dispatchRunSessionCommand((draft) => {
      const state = draft.session.alchemistState;
      const price = computeAlchemistPotionBuyPrice(card, {
        talentEffects,
        runTrinkets: draft.run.activeRun.runTrinkets,
        firstPurchaseUsed: state.firstPurchaseUsed,
      });
      return purchaseShopOffering({
        draft,
        price,
        state,
        setState: setAlchemistState,
        slotKey,
        acquire: () => appendCardToRunWithDiscovery(draft, card),
      });
    });
    playShopSpendFeedback(result);
    return result.committed;
  }

  function mixPotions(indexA: number, indexB: number): BattleCard | null {
    const price = getMixPrice();
    const result = dispatchRunSessionCommand((draft): ShopTransactionResult<BattleCard | null> => {
      const run = draft.run.activeRun;
      const state = draft.session.alchemistState;
      if (
        run.runGold < price ||
        state.mixUsed ||
        indexA < 0 ||
        indexB < 0 ||
        indexA >= run.runDeck.length ||
        indexB >= run.runDeck.length ||
        indexA === indexB
      ) {
        return { committed: false, price, value: null };
      }

      const cardA = run.runDeck[indexA];
      const cardB = run.runDeck[indexB];
      spendRunGold(price, (update) => setRunGold(draft, update));
      setAlchemistState(draft, (previous) => ({ ...previous, mixUsed: true }));
      const mixed = tryCreateMixedPotion(cardA, cardB, talentEffects.potionMixPotency);
      if (mixed) {
        setRunDeck(draft, (previous) => applyMixToDeck(previous, indexA, indexB, mixed));
        setDiscoveredCardIds(draft, (previous) => appendUnique(previous, MIXED_POTION_CARD_ID));
      }
      return { committed: true, price, value: mixed };
    });
    playShopSpendFeedback(result);
    return result.value;
  }

  function refresh(): boolean {
    const result = dispatchRunSessionCommand((draft) => {
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
        mapState: (previous, potions) => ({
          ...previous,
          potions,
          refreshesLeft: previous.refreshesLeft - 1,
          purchasedSlotKeys: [],
        }),
      });
    });
    playShopSpendFeedback(result);
    return result.committed;
  }

  return { initialize, buyPotion, mixPotions, refresh, getPotionBuyPrice, getMixPrice, getRefreshPrice };
}
