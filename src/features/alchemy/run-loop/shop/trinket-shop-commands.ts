import { resolveDraftLootProgress } from "@/features/alchemy/shared/stores/loot-progress";
import { isLootEligible } from "@/lib/loot";
import { grantTrinketToRunWithRecord } from "@/features/alchemy/shared/stores/deck-mutations";
import {
  createDraftRunRandomSource,
  setTrinketShopState,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import type { TalentEffectManifest, TrinketEntry } from "@/lib/game-data";
import { getShopBuyPrice, getShopRefreshPrice } from "./shop-pricing";
import {
  resolveDraftShopModifiers,
  resolveReadShopModifiers,
  resolveReadShopPricingContext,
} from "./shop-pricing-context";
import { refreshShopOfferings, runShopTransaction } from "./shop-transactions";
import { shopItemSlotKey } from "./shop-slot-keys";
import type { TrinketShopCommands } from "./shop-action-types";
import { initializeShop, purchaseSlotOffering } from "./shop-commands-core";
import { createInitialTrinketShopState, resampleTrinketShopOfferings } from "./shop-state-init";

export function createTrinketShopCommands({
  talentEffects,
}: {
  talentEffects: TalentEffectManifest;
}): TrinketShopCommands {
  const getBuyPrice = () => {
    return getShopBuyPrice("trinket", null, resolveReadShopPricingContext(talentEffects, "trinketShopState"));
  };
  const getRefreshPrice = (refreshesLeft: number, modifiers = resolveReadShopModifiers()) =>
    getShopRefreshPrice("trinket", talentEffects, refreshesLeft, modifiers);

  const initialize = initializeShop(setTrinketShopState, (draft) =>
    createInitialTrinketShopState(createDraftRunRandomSource(draft, "shops"), draft.gear.ownedTrinketIds),
  );

  function buy(trinket: TrinketEntry, slotKey: string): boolean {
    return runShopTransaction((draft) => {
      const state = draft.session.trinketShopState;
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

  function refresh(): boolean {
    return runShopTransaction((draft) => {
      const state = draft.session.trinketShopState;
      if (!isLootEligible("trinket", resolveDraftLootProgress(draft).depth))
        return { committed: false, price: 0, value: null };
      return refreshShopOfferings({
        draft,
        price: getShopRefreshPrice("trinket", talentEffects, state.refreshesLeft, resolveDraftShopModifiers(draft)),
        refreshesLeft: state.refreshesLeft,
        setState: setTrinketShopState,
        mapState: (previous, items) => ({ ...previous, trinkets: items }),
        resample: () =>
          resampleTrinketShopOfferings(
            createDraftRunRandomSource(draft, "shops"),
            resolveDraftLootProgress(draft),
            draft.gear.ownedTrinketIds,
            state.trinkets.map((trinket) => trinket.id),
          ),
      });
    }).committed;
  }

  return { initialize, buy, refresh, getBuyPrice, getRefreshPrice };
}
