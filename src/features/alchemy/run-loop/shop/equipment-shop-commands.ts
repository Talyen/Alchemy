import { mutateGearWithRunHealthSync } from "@/features/alchemy/shared/stores/gear-session-command";
import {
  createDraftRunRandomSource,
  recordRunObtainedItem,
  setEquipmentShopState,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import type { TalentEffectManifest } from "@/lib/game-data";
import { getOwnedUniqueDefinitionIds, type GearInstance } from "@/lib/gear";
import { computeGearBuyPrice, computeMerchantRefreshPrice } from "./shop-pricing";
import { resolveDraftShopPricingContext, resolveReadShopPricingContext } from "./shop-pricing-context";
import {
  commitShopInitialize,
  mapRefreshedShopOfferings,
  purchaseShopOffering,
  refreshShopOfferings,
  runShopTransaction,
} from "./shop-transactions";
import type { EquipmentShopCommands } from "./shop-action-types";
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
    return computeGearBuyPrice(instance, resolveReadShopPricingContext(talentEffects, "equipmentShopState"));
  };
  const getRefreshPrice = (refreshesLeft: number) => computeMerchantRefreshPrice(talentEffects, refreshesLeft);

  function initialize(): void {
    commitShopInitialize(setEquipmentShopState, (draft) =>
      createInitialEquipmentShopState(
        createDraftRunRandomSource(draft, "shops"),
        gearAstralChanceBonus,
        getOwnedUniqueDefinitionIds(draft.gear.inventories),
      ),
    );
  }

  function buy(instance: GearInstance): boolean {
    return runShopTransaction((draft) => {
      const state = draft.session.equipmentShopState;
      const offered = state.gear.find((item) => item.instanceId === instance.instanceId);
      if (!offered) return { committed: false, price: 0, value: undefined };
      const price = computeGearBuyPrice(offered, resolveDraftShopPricingContext(talentEffects, draft, state));
      return purchaseShopOffering({
        draft,
        price,
        state,
        setState: setEquipmentShopState,

        slotKey: instance.instanceId,
        offeringMatches: true,
        acquire: () => {
          const characterId = draft.run.activeRun.characterId;
          mutateGearWithRunHealthSync(draft, {
            mutate: (gear) => gear.addInstance(offered, characterId),
          });
          recordRunObtainedItem(draft, { kind: "gear", instance: offered });
        },
      });
    }).committed;
  }

  function refresh(): boolean {
    return runShopTransaction((draft) => {
      const state = draft.session.equipmentShopState;
      return refreshShopOfferings<EquipmentShopState, GearInstance>({
        draft,
        price: getRefreshPrice(state.refreshesLeft),
        refreshesLeft: state.refreshesLeft,
        setState: setEquipmentShopState,
        resample: () =>
          resampleEquipmentShopOfferings(
            createDraftRunRandomSource(draft, "shops"),
            gearAstralChanceBonus,
            getOwnedUniqueDefinitionIds(draft.gear.inventories),
          ),
        mapState: (previous, gear) => mapRefreshedShopOfferings(previous, "gear", gear),
      });
    }).committed;
  }

  return { initialize, buy, refresh, getBuyPrice, getRefreshPrice };
}
