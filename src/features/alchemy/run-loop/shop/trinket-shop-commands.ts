import { bindSessionCapabilities } from "@/features/alchemy/shared/stores/session/session-capabilities";
import { grantTrinketToRunWithRecord } from "@/features/alchemy/shared/stores/commands/deck-mutations";
import { type GameSession } from "@/features/alchemy/shared/stores/session/game-session-types";
import { resolveDraftLootProgress } from "@/features/alchemy/shared/stores/commands/loot-progress";
import {
  createDraftRunRandomSource,
  setTrinketShopState,
} from "@/features/alchemy/shared/stores/commands/run-session-write-port";
import { trinketLibrary } from "@/lib/game-data";
import { isLootEligible } from "@/lib/loot";
import {
  cardSlotKeyOf,
  createGetRefreshPrice,
  createShopPurchaseActions,
  createShopRefreshAction,
} from "./shop-commands-core";
import { getShopBuyPrice } from "./shop-pricing";
import { resampleTrinketShopOfferings } from "./shop-state-init";

export function createTrinketShopCommands(gameSession: GameSession) {
  const { buy, getBuyPrice } = createShopPurchaseActions(
    {
      activity: "trinket-shop",
      itemsOf: (state) => state.trinkets,
      slotKeyOf: cardSlotKeyOf,
      priceOf: (_trinket, context) => getShopBuyPrice({ kind: "trinket", item: null, context }),
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
  const getRefreshPrice = createGetRefreshPrice("trinket-shop", gameSession);

  const refresh = createShopRefreshAction(
    {
      activity: "trinket-shop",
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

  return bindSessionCapabilities(gameSession, { buy, refresh, getBuyPrice, getRefreshPrice });
}
