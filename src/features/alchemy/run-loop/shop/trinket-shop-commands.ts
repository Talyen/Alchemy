import { appendTrinketToRunWithDiscovery } from "@/features/alchemy/run-loop/run/deck-mutations";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { readActiveRun, readRunSession } from "@/features/alchemy/shared/stores/run-session-read-port";
import {
  createDraftRunRandomSource,
  setTrinketShopState,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import type { TalentEffectManifest, TrinketEntry } from "@/lib/game-data";
import { computeMerchantRefreshPrice, computeTrinketBuyPrice } from "./shop-pricing";
import { playShopSpendFeedback, purchaseShopOffering, refreshShopOfferings } from "./shop-transactions";
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
      firstPurchaseUsed: readRunSession().trinketShopState.firstPurchaseUsed,
    });
  const getRefreshPrice = (refreshesLeft: number) => computeMerchantRefreshPrice(talentEffects, refreshesLeft);

  function initialize(): void {
    dispatchRunSessionCommand((draft) =>
      setTrinketShopState(draft, createInitialTrinketShopState(createDraftRunRandomSource(draft, "shops"))),
    );
  }

  function buy(trinket: TrinketEntry, slotKey: string): boolean {
    const result = dispatchRunSessionCommand((draft) => {
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
        acquire: () => appendTrinketToRunWithDiscovery(draft, trinket.id),
      });
    });
    playShopSpendFeedback(result);
    return result.committed;
  }

  function refresh(): boolean {
    const result = dispatchRunSessionCommand((draft) => {
      const state = draft.session.trinketShopState;
      return refreshShopOfferings<TrinketShopState, TrinketEntry>({
        draft,
        price: getRefreshPrice(state.refreshesLeft),
        refreshesLeft: state.refreshesLeft,
        setState: setTrinketShopState,
        resample: () => resampleTrinketShopOfferings(createDraftRunRandomSource(draft, "shops")),
        mapState: (previous, trinkets) => ({
          ...previous,
          trinkets,
          refreshesLeft: previous.refreshesLeft - 1,
          purchasedSlotKeys: [],
        }),
      });
    });
    playShopSpendFeedback(result);
    return result.committed;
  }

  return { initialize, buy, refresh, getBuyPrice, getRefreshPrice };
}
