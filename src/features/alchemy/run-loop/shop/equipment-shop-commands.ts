import { grantGearToRunWithRecord } from "@/features/alchemy/shared/stores/deck-mutations";
import {
  createDraftRunRandomSource,
  setEquipmentShopState,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import type { TalentEffectManifest } from "@/lib/game-data";
import { getOwnedUniqueDefinitionIds, type GearInstance } from "@/lib/gear";
import { refreshShopOfferings, runShopTransaction } from "./shop-transactions";
import type { EquipmentShopCommands } from "./shop-action-types";
import { gearSlotKeyOf, initializeShop, purchaseSlotOffering, readRefreshPrice } from "./shop-commands-core";
import { resolveDraftShopModifiers, resolveReadShopPricingContext } from "./shop-pricing-context";
import { getShopBuyPrice, getShopRefreshPrice } from "./shop-pricing";
import { createInitialEquipmentShopState, resampleEquipmentShopOfferings } from "./shop-state-init";

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
      return refreshShopOfferings({
        draft,
        price: getShopRefreshPrice("equipment", talentEffects, state.refreshesLeft, resolveDraftShopModifiers(draft)),
        refreshesLeft: state.refreshesLeft,
        setState: setEquipmentShopState,
        mapState: (previous, items) => ({ ...previous, gear: items }),
        resample: () =>
          resampleEquipmentShopOfferings(
            createDraftRunRandomSource(draft, "shops"),
            gearAstralChanceBonus,
            getOwnedUniqueDefinitionIds(draft.gear.inventories),
            resolveDraftShopModifiers(draft),
            state.gear,
          ),
      });
    }).committed;
  }

  return { initialize, buy, refresh, getBuyPrice, getRefreshPrice };
}
