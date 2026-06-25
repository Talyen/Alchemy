import { addInventory, emptyInventory } from "@/lib/homestead/inventory";
import { applyEndOfRunHomesteadBonuses } from "@/lib/homestead/loot";
import { readActiveRunStore, readBattleStore, setRunEndMaterials } from "../../shared/stores/run-session-facade";
import { useUiStore } from "../../shared/stores/ui-store";
import { CONSTANTS } from "../../shared/types";

export function clearCombatState() {
  readBattleStore().setHasActiveBattle(false);
  useUiStore.getState().clearCardHover();
}

export function awardRunEndMaterials() {
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
}
