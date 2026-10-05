import { grantTrinketToRunWithRecord } from "@/features/alchemy/shared/stores/deck-mutations";
import { defaultGameSession } from "@/features/alchemy/shared/stores/default-game-session";
import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { resolveDraftLootProgress } from "@/features/alchemy/shared/stores/loot-progress";
import {
  createDraftRunRandomSource,
  setTrinketShopState,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { trinketLibrary, type TalentEffectManifest } from "@/lib/game-data";
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

export function createTrinketShopCommands(
  {
    talentEffects,
  }: {
    talentEffects: TalentEffectManifest;
  },
  gameSession: GameSession = defaultGameSession,
): TrinketShopCommands {
  const { buy, getBuyPrice } = createShopPurchaseActions(
    {
      activity: "trinket-shop",
      talentEffects,
      itemsOf: (state) => state.trinkets,
      slotKeyOf: (item, index) => shopItemSlotKey(item.id, index),
      idOf: (item) => item.id,
      priceOf: (_trinket, context) => getShopBuyPrice("trinket", null, context),
      isAvailable: (draft, offered) => !draft.gear.ownedTrinketIds.includes(offered.id),
      acquire: (draft, offered) => {
        grantTrinketToRunWithRecord(draft, offered.id);
        if (trinketLibrary.every((trinket) => draft.gear.ownedTrinketIds.includes(trinket.id))) {
          setTrinketShopState(draft, (state) => ({ ...state, refreshesLeft: 0 }));
        }
      },
    },
    gameSession,
  );
  const getRefreshPrice = createGetRefreshPrice("trinket-shop", talentEffects, gameSession);

  const initialize = initializeShop(
    "trinket-shop",
    (draft) => createInitialTrinketShopState(createDraftRunRandomSource(draft, "shops"), draft.gear.ownedTrinketIds),
    gameSession,
  );

  const refresh = createShopRefreshAction(
    {
      activity: "trinket-shop",
      talentEffects,
      guard: (draft) =>
        isLootEligible("trinket", resolveDraftLootProgress(draft).depth) &&
        trinketLibrary.some((trinket) => !draft.gear.ownedTrinketIds.includes(trinket.id)),
      resample: (draft, state) => ({
        ...state,
        trinkets: resampleTrinketShopOfferings(
          createDraftRunRandomSource(draft, "shops"),
          resolveDraftLootProgress(draft),
          draft.gear.ownedTrinketIds,
          state.trinkets.map((trinket) => trinket.id),
        ),
      }),
    },
    gameSession,
  );

  return { initialize, buy, refresh, getBuyPrice, getRefreshPrice };
}
