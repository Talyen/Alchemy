import { grantGearToRunWithRecord } from "@/features/alchemy/shared/stores/deck-mutations";
import { resolveDraftLootProgress } from "@/features/alchemy/shared/stores/loot-progress";
import { createDraftRunRandomSource } from "@/features/alchemy/shared/stores/run-session-write-port";
import type { TalentEffectManifest } from "@/lib/game-data";
import { getOwnedUniqueDefinitionIds } from "@/lib/gear";
import type { EquipmentShopCommands } from "./shop-action-types";
import {
  createGetRefreshPrice,
  createShopPurchaseActions,
  createShopRefreshAction,
  gearSlotKeyOf,
  initializeShop,
} from "./shop-commands-core";
import { getShopBuyPrice } from "./shop-pricing";
import { resolveDraftShopModifiers } from "./shop-pricing-context";
import { createInitialEquipmentShopState, resampleEquipmentShopOfferings } from "./shop-state-init";

export function createEquipmentShopCommands({
  talentEffects,
  gearAstralChanceBonus,
}: {
  talentEffects: TalentEffectManifest;
  gearAstralChanceBonus: number;
}): EquipmentShopCommands {
  const { buy, getBuyPrice } = createShopPurchaseActions({
    activity: "equipment-shop",
    talentEffects,
    itemsOf: (state) => state.gear,
    slotKeyOf: gearSlotKeyOf,
    idOf: (item) => item.instanceId,
    priceOf: (instance, context) => getShopBuyPrice("gear", instance, context),
    acquire: grantGearToRunWithRecord,
  });
  const getRefreshPrice = createGetRefreshPrice("equipment-shop", talentEffects);

  const initialize = initializeShop("equipment-shop", (draft) =>
    createInitialEquipmentShopState(
      createDraftRunRandomSource(draft, "shops"),
      resolveDraftLootProgress(draft),
      gearAstralChanceBonus,
      getOwnedUniqueDefinitionIds(draft.gear.inventories),
      resolveDraftShopModifiers(draft),
    ),
  );

  const refresh = createShopRefreshAction({
    activity: "equipment-shop",
    talentEffects,
    resample: (draft, state, modifiers) => ({
      ...state,
      gear: resampleEquipmentShopOfferings(
        createDraftRunRandomSource(draft, "shops"),
        resolveDraftLootProgress(draft),
        gearAstralChanceBonus,
        getOwnedUniqueDefinitionIds(draft.gear.inventories),
        modifiers,
        state.gear,
      ),
    }),
  });

  return { initialize, buy, refresh, getBuyPrice, getRefreshPrice };
}
