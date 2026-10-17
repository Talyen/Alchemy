import { bindSessionCapabilities } from "@/features/alchemy/shared/stores/session-capabilities";
import { grantGearToRunWithRecord } from "@/features/alchemy/shared/stores/deck-mutations";
import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { resolveDraftLootProgress } from "@/features/alchemy/shared/stores/loot-progress";
import { snapshotTransactionValue } from "@/features/alchemy/shared/stores/run-session-command";
import {
  createDraftInstanceIdSource,
  createDraftRunRandomSource,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { getOwnedUniqueDefinitionIds } from "@/lib/gear";
import {
  createGetRefreshPrice,
  createShopPurchaseActions,
  createShopRefreshAction,
  gearSlotKeyOf,
} from "./shop-commands-core";
import { getShopBuyPrice } from "./shop-pricing";
import { resampleEquipmentShopOfferings } from "./shop-state-init";

export function createEquipmentShopCommands(gameSession: GameSession) {
  const { buy, getBuyPrice } = createShopPurchaseActions(
    {
      activity: "equipment-shop",
      itemsOf: (state) => state.gear,
      slotKeyOf: gearSlotKeyOf,
      priceOf: (instance, context) => getShopBuyPrice("gear", instance, context),
      acquire: grantGearToRunWithRecord,
    },
    gameSession,
  );
  const getRefreshPrice = createGetRefreshPrice("equipment-shop", gameSession);

  const refresh = createShopRefreshAction(
    {
      activity: "equipment-shop",
      resample: (draft, state, modifiers) => ({
        ...state,
        gear: resampleEquipmentShopOfferings(
          createDraftRunRandomSource(draft, "shops"),
          resolveDraftLootProgress(draft),
          draft.runProfile.effects.gearAstralChanceBonus,
          getOwnedUniqueDefinitionIds(snapshotTransactionValue(draft.gear.inventories)),
          modifiers,
          state.gear,
          createDraftInstanceIdSource(draft),
        ),
      }),
    },
    gameSession,
  );

  return bindSessionCapabilities(gameSession, { buy, refresh, getBuyPrice, getRefreshPrice });
}
