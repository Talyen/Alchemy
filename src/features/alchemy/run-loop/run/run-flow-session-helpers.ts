import { addInventory, emptyInventory } from "@/lib/homestead/inventory";
import { applyEndOfRunHomesteadBonuses } from "@/lib/homestead/loot";
import { readActiveRun, readRunProfile } from "@/features/alchemy/shared/stores/run-session-read-port";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { setHasActiveBattle, setRunEndMaterials } from "@/features/alchemy/shared/stores/run-session-write-port";
import { useUiStore } from "../../shared/stores/ui-store";
import { CONSTANTS } from "../../shared/types";

/** Clear the persisted battle-active state; presentation cleanup is a post-commit concern. */
export function clearCombatState() {
  setHasActiveBattle(false);
}

/** Clear transient combat presentation after the gameplay state has committed. */
export function clearCombatPresentation() {
  useUiStore.getState().clearCardHover();
}

export function awardRunEndMaterials() {
  return dispatchRunSessionCommand(() => {
    const runState = readActiveRun();
    if (runState.contentSystemType === CONSTANTS.CONTENT_SYSTEMS.WILDWOOD) {
      runState.clearRunMaterialsEarned();
      const none = emptyInventory();
      setRunEndMaterials(none);
      return none;
    }
    const runCollected = runState.runMaterialsEarned;
    const homesteadBonus = applyEndOfRunHomesteadBonuses(
      emptyInventory(),
      readRunProfile().effects,
      runState.roomsEncountered,
    );
    readRunProfile().addMaterials(homesteadBonus);
    setRunEndMaterials(addInventory(runCollected, homesteadBonus));
    runState.clearRunMaterialsEarned();
    return homesteadBonus;
  });
}
