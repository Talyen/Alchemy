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
import {
  createGetRefreshPrice,
  createShopRefreshAction,
  gearSlotKeyOf,
  initializeShop,
  purchaseSlotOffering,
} from "./shop-commands-core";
import { getShopBuyPrice } from "./shop-pricing";
import { resolveDraftShopModifiers, resolveReadShopPricingContext } from "./shop-pricing-context";
import { createInitialEquipmentShopState, resampleEquipmentShopOfferings } from "./shop-state-init";
import { runShopTransaction } from "./shop-transactions";

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
  const getRefreshPrice = createGetRefreshPrice("equipment", talentEffects);

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

  const refresh = createShopRefreshAction({
    activity: "equipment-shop",
    kind: "equipment",
    talentEffects,
    setState: setEquipmentShopState,
    mapState: (previous, gear: GearInstance[]) => ({ ...previous, gear }),
    resample: (draft, state, modifiers) =>
      resampleEquipmentShopOfferings(
        createDraftRunRandomSource(draft, "shops"),
        resolveDraftLootProgress(draft),
        gearAstralChanceBonus,
        getOwnedUniqueDefinitionIds(draft.gear.inventories),
        modifiers,
        state.gear,
      ),
  });

  return { initialize, buy, refresh, getBuyPrice, getRefreshPrice };
}
