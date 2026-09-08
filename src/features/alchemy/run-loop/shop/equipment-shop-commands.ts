import { grantGearToRunWithRecord } from "@/features/alchemy/shared/stores/deck-mutations";
import {
  createDraftRunRandomSource,
  setEquipmentShopState,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import type { TalentEffectManifest } from "@/lib/game-data";
import { getOwnedUniqueDefinitionIds, type GearInstance } from "@/lib/gear";
import { runShopTransaction } from "./shop-transactions";
import type { EquipmentShopCommands } from "./shop-action-types";
import {
  gearSlotKeyOf,
  initializeShop,
  purchaseSlotOffering,
  readRefreshPrice,
  refreshCatalogOfferings,
} from "./shop-commands-core";
import { resolveDraftShopModifiers, resolveReadShopPricingContext } from "./shop-pricing-context";
import { getShopBuyPrice } from "./shop-pricing";
import {
  createInitialEquipmentShopState,
  resampleEquipmentShopOfferings,
  type EquipmentShopState,
} from "./shop-state-init";

export function createEquipmentShopCommands({
  talentEffects,
  gearAstralChanceBonus,
}: {
  talentEffects: TalentEffectManifest;
  gearAstralChanceBonus: number;
}): EquipmentShopCommands {
  const getBuyPrice = (instance: GearInstance) => {
    return getShopBuyPrice("gear", instance, resolveReadShopPricingContext(talentEffects, "equipmentShopState"));
  };
  const getRefreshPrice = (refreshesLeft: number) => readRefreshPrice("equipment", talentEffects, refreshesLeft);

  const initialize = initializeShop(setEquipmentShopState, (draft) =>
    createInitialEquipmentShopState(
      createDraftRunRandomSource(draft, "shops"),
      gearAstralChanceBonus,
      getOwnedUniqueDefinitionIds(draft.gear.inventories),
      resolveDraftShopModifiers(draft),
    ),
  );

  function buy(instance: GearInstance, slotKey: string): boolean {
    return runShopTransaction((draft) => {
      const state = draft.session.equipmentShopState;
      return purchaseSlotOffering({
        talentEffects,
        state,
        setState: setEquipmentShopState,
        draft,
        items: state.gear,
        requestedId: instance.instanceId,
        slotKey,
        buyKind: "gear",
        slotKeyOf: (item) => gearSlotKeyOf(item),
        idOf: (item) => item.instanceId,
        acquire: (innerDraft, offered) => grantGearToRunWithRecord(innerDraft, offered),
      });
    }).committed;
  }

  function refresh(): boolean {
    return runShopTransaction((draft) => {
      const state = draft.session.equipmentShopState;
      return refreshCatalogOfferings<EquipmentShopState, GearInstance>({
        talentEffects,
        draft,
        state,
        setState: setEquipmentShopState,
        itemsKey: "gear",
        refreshKind: "equipment",
        resample: () =>
          resampleEquipmentShopOfferings(
            createDraftRunRandomSource(draft, "shops"),
            gearAstralChanceBonus,
            getOwnedUniqueDefinitionIds(draft.gear.inventories),
            resolveDraftShopModifiers(draft),
          ),
      });
    }).committed;
  }

  return { initialize, buy, refresh, getBuyPrice, getRefreshPrice };
}
