import { addInventory, emptyInventory } from "@/lib/homestead/inventory";
import { applyEndOfRunHomesteadBonuses } from "@/lib/homestead/loot";
import type { GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import {
  addMaterials,
  clearRunMaterialsEarned,
  setHasActiveBattle,
  setRunEndMaterials,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { clearBattlePresentationUi } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import { CONSTANTS } from "../../shared/types";

/** Clear the persisted battle-active state; presentation cleanup is a post-commit concern. */
export function clearCombatState(draft: GameplayDraft) {
  setHasActiveBattle(draft, false);
}

/** Clear transient combat presentation after the gameplay state has committed. */
export function clearCombatPresentation() {
  clearBattlePresentationUi();
}

export function awardRunEndMaterials(draft: GameplayDraft): ReturnType<typeof emptyInventory> {
  const runState = draft.run.activeRun;
  const runProfile = draft.runProfile;
  {
    if (runState.contentSystemType === CONSTANTS.CONTENT_SYSTEMS.WILDWOOD) {
      clearRunMaterialsEarned(draft);
      const none = emptyInventory();
      setRunEndMaterials(draft, none);
      return none;
    }
    const runCollected = runState.runMaterialsEarned;
    const homesteadBonus = applyEndOfRunHomesteadBonuses(
      emptyInventory(),
      runProfile.effects,
      runState.roomsEncountered,
    );
    addMaterials(draft, homesteadBonus);
    setRunEndMaterials(draft, addInventory(runCollected, homesteadBonus));
    clearRunMaterialsEarned(draft);
    return homesteadBonus;
  }
}
