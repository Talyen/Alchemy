import { grantTrinketToRunWithRecord } from "@/features/alchemy/shared/stores/deck-mutations";
import { resolveDraftLootProgress } from "@/features/alchemy/shared/stores/loot-progress";
import { createDraftRunRandomSource } from "@/features/alchemy/shared/stores/run-session-write-port";
import type { TalentEffectManifest } from "@/lib/game-data";
import { isLootEligible } from "@/lib/loot";
import type { TrinketShopCommands } from "./shop-action-types";
import {
  createGetRefreshPrice,
  createShopPurchaseActions,
  createShopRefreshAction,
  initializeShop,
} from "./shop-commands-core";
import { getShopBuyPrice } from "./shop-pricing";
import { shopItemSlotKey } from "./shop-slot-keys";
import { createInitialTrinketShopState, resampleTrinketShopOfferings } from "./shop-state-init";

export function createTrinketShopCommands({
  talentEffects,
}: {
  talentEffects: TalentEffectManifest;
}): TrinketShopCommands {
  const { buy, getBuyPrice } = createShopPurchaseActions({
    activity: "trinket-shop",
    talentEffects,
    itemsOf: (state) => state.trinkets,
    slotKeyOf: (item, index) => shopItemSlotKey(item.id, index),
    idOf: (item) => item.id,
    priceOf: (_trinket, context) => getShopBuyPrice("trinket", null, context),
    isAvailable: (draft, offered) => !draft.gear.ownedTrinketIds.includes(offered.id),
    acquire: (draft, offered) => grantTrinketToRunWithRecord(draft, offered.id),
  });
  const getRefreshPrice = createGetRefreshPrice("trinket-shop", talentEffects);

  const initialize = initializeShop("trinket-shop", (draft) =>
    createInitialTrinketShopState(createDraftRunRandomSource(draft, "shops"), draft.gear.ownedTrinketIds),
  );

  const refresh = createShopRefreshAction({
    activity: "trinket-shop",
    talentEffects,
    guard: (draft) => isLootEligible("trinket", resolveDraftLootProgress(draft).depth),
    resample: (draft, state) => ({
      ...state,
      trinkets: resampleTrinketShopOfferings(
        createDraftRunRandomSource(draft, "shops"),
        resolveDraftLootProgress(draft),
        draft.gear.ownedTrinketIds,
        state.trinkets.map((trinket) => trinket.id),
      ),
    }),
  });

  return { initialize, buy, refresh, getBuyPrice, getRefreshPrice };
}
