import { grantTrinketToRunWithRecord } from "@/features/alchemy/shared/stores/deck-mutations";
import { resolveDraftLootProgress } from "@/features/alchemy/shared/stores/loot-progress";
import {
  createDraftRunRandomSource,
  setTrinketShopState,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { readActivityData } from "@/lib/active-run-session";
import type { TalentEffectManifest, TrinketEntry } from "@/lib/game-data";
import { isLootEligible } from "@/lib/loot";
import type { TrinketShopCommands } from "./shop-action-types";
import {
  createGetRefreshPrice,
  createShopRefreshAction,
  initializeShop,
  purchaseSlotOffering,
} from "./shop-commands-core";
import { getShopBuyPrice } from "./shop-pricing";
import { resolveReadShopPricingContext } from "./shop-pricing-context";
import { shopItemSlotKey } from "./shop-slot-keys";
import { createInitialTrinketShopState, resampleTrinketShopOfferings } from "./shop-state-init";
import { runShopTransaction } from "./shop-transactions";

export function createTrinketShopCommands({
  talentEffects,
}: {
  talentEffects: TalentEffectManifest;
}): TrinketShopCommands {
  const getBuyPrice = () => {
    return getShopBuyPrice("trinket", null, resolveReadShopPricingContext(talentEffects, "trinketShopState"));
  };
  const getRefreshPrice = createGetRefreshPrice("trinket", talentEffects);

  const initialize = initializeShop(setTrinketShopState, (draft) =>
    createInitialTrinketShopState(createDraftRunRandomSource(draft, "shops"), draft.gear.ownedTrinketIds),
  );

  function buy(trinket: TrinketEntry, slotKey: string): boolean {
    return runShopTransaction("trinket-shop", (draft) => {
      const state = readActivityData(draft.session.activity, "trinket-shop");
      return purchaseSlotOffering({
        talentEffects,
        state,
        setState: setTrinketShopState,
        draft,
        items: state.trinkets,
        requestedId: trinket.id,
        slotKey,
        buyKind: "trinket",
        slotKeyOf: (item, index) => shopItemSlotKey(item.id, index),
        idOf: (item) => item.id,
        isAvailable: (innerDraft, offered) => !innerDraft.gear.ownedTrinketIds.includes(offered.id),
        acquire: (innerDraft, offered) => grantTrinketToRunWithRecord(innerDraft, offered.id),
      });
    }).committed;
  }

  const refresh = createShopRefreshAction({
    activity: "trinket-shop",
    kind: "trinket",
    talentEffects,
    setState: setTrinketShopState,
    guard: (draft) => isLootEligible("trinket", resolveDraftLootProgress(draft).depth),
    mapState: (previous, trinkets: TrinketEntry[]) => ({ ...previous, trinkets }),
    resample: (draft, state) =>
      resampleTrinketShopOfferings(
        createDraftRunRandomSource(draft, "shops"),
        resolveDraftLootProgress(draft),
        draft.gear.ownedTrinketIds,
        state.trinkets.map((trinket) => trinket.id),
      ),
  });

  return { initialize, buy, refresh, getBuyPrice, getRefreshPrice };
}
