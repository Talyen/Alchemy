import { addInventory, emptyInventory } from "@/lib/homestead/inventory";
import { applyEndOfRunHomesteadBonuses } from "@/lib/homestead/loot";
import {
  readActiveRunStore,
  readBattleStore,
  runSessionTransaction,
  setRunEndMaterials,
} from "../../shared/stores/run-session-facade";
import { useUiStore } from "../../shared/stores/ui-store";
import { CONSTANTS } from "../../shared/types";

/** Clear the persisted battle-active state; presentation cleanup is a post-commit concern. */
export function clearCombatState() {
  readBattleStore().setHasActiveBattle(false);
}

/** Clear transient combat presentation after the gameplay state has committed. */
export function clearCombatPresentation() {
  useUiStore.getState().clearCardHover();
}

export function awardRunEndMaterials() {
  return runSessionTransaction(() => {
    const runState = readActiveRunStore();
    if (runState.contentSystemType === CONSTANTS.CONTENT_SYSTEMS.WILDWOOD) {
      runState.clearRunMaterialsEarned();
      const none = emptyInventory();
      setRunEndMaterials(none);
      return none;
    }
    const runCollected = runState.runMaterialsEarned;
    const homesteadBonus = applyEndOfRunHomesteadBonuses(emptyInventory(), runState.effects, runState.roomsEncountered);
    runState.addMaterials(homesteadBonus);
    setRunEndMaterials(addInventory(runCollected, homesteadBonus));
    runState.clearRunMaterialsEarned();
    return homesteadBonus;
  });
}
