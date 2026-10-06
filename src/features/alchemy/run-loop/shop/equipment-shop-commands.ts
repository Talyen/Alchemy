import { bindSessionCapabilities } from "@/features/alchemy/shared/stores/session-capabilities";
import { createShopInitializer } from "./shop-initialization";
import { grantGearToRunWithRecord } from "@/features/alchemy/shared/stores/deck-mutations";
import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { resolveDraftLootProgress } from "@/features/alchemy/shared/stores/loot-progress";
import { snapshotTransactionValue } from "@/features/alchemy/shared/stores/run-session-command";
import {
  createDraftInstanceIdSource,
  createDraftRunRandomSource,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import type { TalentEffectManifest } from "@/lib/game-data";
import { getOwnedUniqueDefinitionIds } from "@/lib/gear";
import type { EquipmentShopCommands } from "./shop-action-types";
import {
  createGetRefreshPrice,
  createShopPurchaseActions,
  createShopRefreshAction,
  gearSlotKeyOf,
} from "./shop-commands-core";
import { getShopBuyPrice } from "./shop-pricing";
import { resampleEquipmentShopOfferings } from "./shop-state-init";

export function createEquipmentShopCommands(
  {
    talentEffects,
    gearAstralChanceBonus,
  }: {
    talentEffects: TalentEffectManifest;
    gearAstralChanceBonus: number;
  },
  gameSession: GameSession,
): EquipmentShopCommands {
  const { buy, getBuyPrice } = createShopPurchaseActions(
    {
      activity: "equipment-shop",
      talentEffects,
      itemsOf: (state) => state.gear,
      slotKeyOf: gearSlotKeyOf,
      idOf: (item) => item.instanceId,
      priceOf: (instance, context) => getShopBuyPrice("gear", instance, context),
      acquire: grantGearToRunWithRecord,
    },
    gameSession,
  );
  const getRefreshPrice = createGetRefreshPrice("equipment-shop", talentEffects, gameSession);

  const initialize = createShopInitializer("equipment", gameSession, gearAstralChanceBonus);

  const refresh = createShopRefreshAction(
    {
      activity: "equipment-shop",
      talentEffects,
      resample: (draft, state, modifiers) => ({
        ...state,
        gear: resampleEquipmentShopOfferings(
          createDraftRunRandomSource(draft, "shops"),
          resolveDraftLootProgress(draft),
          gearAstralChanceBonus,
          getOwnedUniqueDefinitionIds(snapshotTransactionValue(draft.gear.inventories)),
          modifiers,
          state.gear,
          createDraftInstanceIdSource(draft),
        ),
      }),
    },
    gameSession,
  );

  return bindSessionCapabilities(gameSession, { initialize, buy, refresh, getBuyPrice, getRefreshPrice });
}
