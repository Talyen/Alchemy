import { appendCardToRunWithDiscovery, discoverCardIds } from "@/features/alchemy/run-loop/run/deck-mutations";
import { spendRunGold } from "@/features/alchemy/run-loop/run-gold";
import { readActiveRun, readShopFirstPurchaseUsed } from "@/features/alchemy/shared/stores/run-session-read-port";
import { readDraftGold } from "@/features/alchemy/shared/stores/gold-purse";
import {
  createDraftRunRandomSource,
  setAlchemistState,
  setRunDeck,
  setRunGold,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { applyMixToDeck, tryCreateMixedPotion } from "@/lib/alchemist";
import { ALCHEMIST_POTIONS_OFFERED, MIXED_POTION_CARD_ID } from "@/lib/game-constants";
import type { BattleCard, TalentEffectManifest } from "@/lib/game-data";
import type { HomesteadEffectManifest } from "@/lib/homestead/types";
import { getStandardPotionPool } from "@/lib/game-data/cards/card-pools";
import { computeAlchemistPotionBuyPrice, computeAlchemistRefreshPrice, computeMixPotionPrice } from "./shop-pricing";
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
import { readEquippedTrinketId } from "@/features/alchemy/shared/stores/gear-store";
import { combineTrinketEffectIds } from "@/lib/trinkets";

export function createAlchemistShopCommands({
  talentEffects,
  homesteadEffects,
}: {
  talentEffects: TalentEffectManifest;
  homesteadEffects: HomesteadEffectManifest;
}): AlchemistShopCommands {
  const getPotionBuyPrice = (card: BattleCard) => {
    const run = readActiveRun();
    return computeAlchemistPotionBuyPrice(card, {
      talentEffects,
      runBoons: combineTrinketEffectIds(run.runBoons, readEquippedTrinketId(run.characterId)),
      firstPurchaseUsed: readShopFirstPurchaseUsed("alchemistState"),
    });
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
      const price = computeAlchemistPotionBuyPrice(card, {
        talentEffects,
        runBoons: combineTrinketEffectIds(
          draft.run.activeRun.runBoons,
          draft.gear.equippedTrinkets[draft.run.activeRun.characterId],
        ),
        firstPurchaseUsed: state.firstPurchaseUsed,
      });
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
      if (!cardA || !cardB || cardA.id === MIXED_POTION_CARD_ID || cardB.id === MIXED_POTION_CARD_ID) {
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
      spendRunGold(price, (update) => setRunGold(draft, update));
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
