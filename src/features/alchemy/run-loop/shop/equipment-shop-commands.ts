import { mutateGearWithRunHealthSync } from "@/features/alchemy/shared/stores/gear-session-command";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { readActiveRun, readRunSession } from "@/features/alchemy/shared/stores/run-session-read-port";
import {
  createDraftRunRandomSource,
  setEquipmentShopState,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import type { TalentEffectManifest } from "@/lib/game-data";
import type { GearInstance } from "@/lib/gear";
import { purchaseShopOffering, refreshShopOfferings } from "../shop-transactions";
import type { EquipmentShopCommands } from "./shop-action-types";
import { playShopSpendFeedback } from "./shop-feedback";
import { computeGearBuyPrice, computeMerchantRefreshPrice } from "./shop-price-selectors";
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
  const getBuyPrice = (instance: GearInstance) =>
    computeGearBuyPrice(instance, {
      talentEffects,
      runTrinkets: readActiveRun().runTrinkets,
      firstPurchaseUsed: readRunSession().equipmentShopState.firstPurchaseUsed,
    });
  const getRefreshPrice = (refreshesLeft: number) => computeMerchantRefreshPrice(talentEffects, refreshesLeft);

  function initialize(): void {
    dispatchRunSessionCommand((draft) =>
      setEquipmentShopState(
        draft,
        createInitialEquipmentShopState(createDraftRunRandomSource(draft, "shops"), gearAstralChanceBonus),
      ),
    );
  }

  function buy(instance: GearInstance): boolean {
    const result = dispatchRunSessionCommand((draft) => {
      const state = draft.session.equipmentShopState;
      const price = computeGearBuyPrice(instance, {
        talentEffects,
        runTrinkets: draft.run.activeRun.runTrinkets,
        firstPurchaseUsed: state.firstPurchaseUsed,
      });
      return purchaseShopOffering({
        draft,
        price,
        state,
        setState: setEquipmentShopState,
        slotKey: instance.instanceId,
        acquire: () => {
          const characterId = draft.run.activeRun.characterId;
          mutateGearWithRunHealthSync(draft, {
            characterId,
            mutate: (gear) => gear.addInstance(instance, characterId),
          });
        },
      });
    });
    playShopSpendFeedback(result);
    return result.committed;
  }

  function refresh(): boolean {
    const result = dispatchRunSessionCommand((draft) => {
      const state = draft.session.equipmentShopState;
      return refreshShopOfferings<EquipmentShopState, GearInstance>({
        draft,
        price: getRefreshPrice(state.refreshesLeft),
        refreshesLeft: state.refreshesLeft,
        setState: setEquipmentShopState,
        resample: () =>
          resampleEquipmentShopOfferings(createDraftRunRandomSource(draft, "shops"), gearAstralChanceBonus),
        mapState: (previous, gear) => ({
          ...previous,
          gear,
          refreshesLeft: previous.refreshesLeft - 1,
          purchasedSlotKeys: [],
        }),
      });
    });
    playShopSpendFeedback(result);
    return result.committed;
  }

  return { initialize, buy, refresh, getBuyPrice, getRefreshPrice };
}
