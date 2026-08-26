import { mutateGearWithRunHealthSync } from "@/features/alchemy/shared/stores/gear-session-command";
import { discoverTrinketIds } from "@/features/alchemy/shared/stores/profile-store";
import {
  createDraftRunRandomSource,
  recordRunObtainedItem,
  setTrinketShopState,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import type { TalentEffectManifest, TrinketEntry } from "@/lib/game-data";
import { computeMerchantRefreshPrice, computeTrinketBuyPrice } from "./shop-pricing";
import { resolveDraftShopPricingContext, resolveReadShopPricingContext } from "./shop-pricing-context";
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
  const getBuyPrice = (_trinket: TrinketEntry) => {
    return computeTrinketBuyPrice(resolveReadShopPricingContext(talentEffects, "trinketShopState"));
  };
  const getRefreshPrice = (refreshesLeft: number) => computeMerchantRefreshPrice(talentEffects, refreshesLeft);

  function initialize(): void {
    commitShopInitialize(setTrinketShopState, (draft) =>
      createInitialTrinketShopState(createDraftRunRandomSource(draft, "shops"), draft.gear.ownedTrinketIds),
    );
  }

  function buy(trinket: TrinketEntry, slotKey: string): boolean {
    return runShopTransaction((draft) => {
      const state = draft.session.trinketShopState;
      const price = computeTrinketBuyPrice(resolveDraftShopPricingContext(talentEffects, draft, state));
      return purchaseShopOffering({
        draft,
        price,
        state,
        setState: setTrinketShopState,
        slotKey,
        offeringMatches:
          !draft.gear.ownedTrinketIds.includes(trinket.id) &&
          shopArrayOfferingMatches(state.trinkets, slotKey, trinket.id, (offered) => offered.id),
        acquire: () => {
          mutateGearWithRunHealthSync(draft, { mutate: (gear) => gear.addTrinket(trinket.id) });
          discoverTrinketIds(draft, [trinket.id]);
          recordRunObtainedItem(draft, { kind: "trinket", trinketId: trinket.id });
        },
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
          resampleTrinketShopOfferings(createDraftRunRandomSource(draft, "shops"), draft.gear.ownedTrinketIds),
        mapState: (previous, trinkets) => mapRefreshedShopOfferings(previous, "trinkets", trinkets),
      });
    }).committed;
  }

  return { initialize, buy, refresh, getBuyPrice, getRefreshPrice };
}
