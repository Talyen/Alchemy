import { mutateGearWithRunHealthSync } from "@/features/alchemy/shared/stores/gear-session-command";
import { readActiveRun, readShopFirstPurchaseUsed } from "@/features/alchemy/shared/stores/run-session-read-port";
import {
  createDraftRunRandomSource,
  setEquipmentShopState,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import type { TalentEffectManifest } from "@/lib/game-data";
import type { GearInstance } from "@/lib/gear";
import { computeGearBuyPrice, computeMerchantRefreshPrice } from "./shop-pricing";
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
import { readEquippedTrinketId } from "@/features/alchemy/shared/stores/gear-store";
import { combineTrinketEffectIds } from "@/lib/trinkets";

export function createEquipmentShopCommands({
  talentEffects,
  gearAstralChanceBonus,
}: {
  talentEffects: TalentEffectManifest;
  gearAstralChanceBonus: number;
}): EquipmentShopCommands {
  const getBuyPrice = (instance: GearInstance) => {
    const run = readActiveRun();
    return computeGearBuyPrice(instance, {
      talentEffects,
      runBoons: combineTrinketEffectIds(run.runBoons, readEquippedTrinketId(run.characterId)),
      firstPurchaseUsed: readShopFirstPurchaseUsed("equipmentShopState"),
    });
  };
  const getRefreshPrice = (refreshesLeft: number) => computeMerchantRefreshPrice(talentEffects, refreshesLeft);

  function initialize(): void {
    commitShopInitialize(setEquipmentShopState, (draft) =>
      createInitialEquipmentShopState(createDraftRunRandomSource(draft, "shops"), gearAstralChanceBonus),
    );
  }

  function buy(instance: GearInstance): boolean {
    return runShopTransaction((draft) => {
      const state = draft.session.equipmentShopState;
      const price = computeGearBuyPrice(instance, {
        talentEffects,
        runBoons: combineTrinketEffectIds(
          draft.run.activeRun.runBoons,
          draft.gear.equippedTrinkets[draft.run.activeRun.characterId],
        ),
        firstPurchaseUsed: state.firstPurchaseUsed,
      });
      return purchaseShopOffering({
        draft,
        price,
        state,
        setState: setEquipmentShopState,
        slotKey: instance.instanceId,
        offeringMatches: state.gear.some((offered) => offered.instanceId === instance.instanceId),
        acquire: () => {
          const characterId = draft.run.activeRun.characterId;
          mutateGearWithRunHealthSync(draft, {
            mutate: (gear) => gear.addInstance(instance, characterId),
          });
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
          resampleEquipmentShopOfferings(createDraftRunRandomSource(draft, "shops"), gearAstralChanceBonus),
        mapState: (previous, gear) => mapRefreshedShopOfferings(previous, "gear", gear),
      });
    }).committed;
  }

  return { initialize, buy, refresh, getBuyPrice, getRefreshPrice };
}
