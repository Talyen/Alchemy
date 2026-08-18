import { appendTrinketToRunWithDiscovery } from "@/features/alchemy/run-loop/run/deck-mutations";
import { readActiveRun, readShopFirstPurchaseUsed } from "@/features/alchemy/shared/stores/run-session-read-port";
import {
  createDraftRunRandomSource,
  setTrinketShopState,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import type { TalentEffectManifest, TrinketEntry } from "@/lib/game-data";
import { computeMerchantRefreshPrice, computeTrinketBuyPrice } from "./shop-pricing";
import {
  commitShopInitialize,
  mapRefreshedShopOfferings,
  purchaseShopOffering,
  refreshShopOfferings,
  runShopTransaction,
} from "./shop-transactions";
import { shopArrayOfferingMatches } from "./shop-slot-keys";
import type { TrinketShopCommands } from "./shop-action-types";
import { createInitialTrinketShopState, resampleTrinketShopOfferings, type TrinketShopState } from "./shop-state-init";

export function createTrinketShopCommands({
  talentEffects,
}: {
  talentEffects: TalentEffectManifest;
}): TrinketShopCommands {
  const getBuyPrice = (_trinket: TrinketEntry) =>
    computeTrinketBuyPrice({
      talentEffects,
      runTrinkets: readActiveRun().runTrinkets,
      firstPurchaseUsed: readShopFirstPurchaseUsed("trinketShopState"),
    });
  const getRefreshPrice = (refreshesLeft: number) => computeMerchantRefreshPrice(talentEffects, refreshesLeft);

  function initialize(): void {
    commitShopInitialize(setTrinketShopState, (draft) =>
      createInitialTrinketShopState(createDraftRunRandomSource(draft, "shops"), draft.run.activeRun.runTrinkets),
    );
  }

  function buy(trinket: TrinketEntry, slotKey: string): boolean {
    return runShopTransaction((draft) => {
      const state = draft.session.trinketShopState;
      const price = computeTrinketBuyPrice({
        talentEffects,
        runTrinkets: draft.run.activeRun.runTrinkets,
        firstPurchaseUsed: state.firstPurchaseUsed,
      });
      return purchaseShopOffering({
        draft,
        price,
        state,
        setState: setTrinketShopState,
        slotKey,
        offeringMatches:
          !draft.run.activeRun.runTrinkets.includes(trinket.id) &&
          shopArrayOfferingMatches(state.trinkets, slotKey, trinket.id, (offered) => offered.id),
        acquire: () => appendTrinketToRunWithDiscovery(draft, trinket.id),
      });
    }).committed;
  }

  function refresh(): boolean {
    return runShopTransaction((draft) => {
      const state = draft.session.trinketShopState;
      return refreshShopOfferings<TrinketShopState, TrinketEntry>({
        draft,
        price: getRefreshPrice(state.refreshesLeft),
        refreshesLeft: state.refreshesLeft,
        setState: setTrinketShopState,
        resample: () =>
          resampleTrinketShopOfferings(createDraftRunRandomSource(draft, "shops"), draft.run.activeRun.runTrinkets),
        mapState: (previous, trinkets) => mapRefreshedShopOfferings(previous, "trinkets", trinkets),
      });
    }).committed;
  }

  return { initialize, buy, refresh, getBuyPrice, getRefreshPrice };
}
