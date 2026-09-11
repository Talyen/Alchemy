import { grantGearToRunWithRecord } from "@/features/alchemy/shared/stores/deck-mutations";
import { resolveDraftLootProgress } from "@/features/alchemy/shared/stores/loot-progress";
import {
  createDraftRunRandomSource,
  setEquipmentShopState,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { readActivityData } from "@/lib/active-run-session";
import type { TalentEffectManifest } from "@/lib/game-data";
import { getOwnedUniqueDefinitionIds, type GearInstance } from "@/lib/gear";
import type { EquipmentShopCommands } from "./shop-action-types";
import { gearSlotKeyOf, initializeShop, purchaseSlotOffering, readRefreshPrice } from "./shop-commands-core";
import { getShopBuyPrice, getShopRefreshPrice } from "./shop-pricing";
import { resolveDraftShopModifiers, resolveReadShopPricingContext } from "./shop-pricing-context";
import { createInitialEquipmentShopState, resampleEquipmentShopOfferings } from "./shop-state-init";
import { refreshShopOfferings, runShopTransaction } from "./shop-transactions";

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
      resolveDraftLootProgress(draft),
      gearAstralChanceBonus,
      getOwnedUniqueDefinitionIds(draft.gear.inventories),
      resolveDraftShopModifiers(draft),
    ),
  );

  function buy(instance: GearInstance, slotKey: string): boolean {
    return runShopTransaction("equipment-shop", (draft) => {
      const state = readActivityData(draft.session.activity, "equipment-shop");
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
    return runShopTransaction(
      "equipment-shop",
      (draft) => {
        const state = readActivityData(draft.session.activity, "equipment-shop");
        return refreshShopOfferings({
          draft,
          price: getShopRefreshPrice("equipment", talentEffects, state.refreshesLeft, resolveDraftShopModifiers(draft)),
          refreshesLeft: state.refreshesLeft,
          setState: setEquipmentShopState,
          mapState: (previous, items) => ({ ...previous, gear: items }),
          resample: () =>
            resampleEquipmentShopOfferings(
              createDraftRunRandomSource(draft, "shops"),
              resolveDraftLootProgress(draft),
              gearAstralChanceBonus,
              getOwnedUniqueDefinitionIds(draft.gear.inventories),
              resolveDraftShopModifiers(draft),
              state.gear,
            ),
        });
      },
      "shopRefresh",
    ).committed;
  }

  return { initialize, buy, refresh, getBuyPrice, getRefreshPrice };
}
