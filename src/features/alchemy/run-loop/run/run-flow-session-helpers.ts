import { addInventory, emptyInventory } from "@/lib/homestead/inventory";
import { applyEndOfRunHomesteadBonuses } from "@/lib/homestead/loot";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import type { GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import {
  addMaterials,
  clearRunMaterialsEarned,
  setHasActiveBattle,
  setRunEndMaterials,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { useUiStore } from "../../shared/stores/ui-store";
import { CONSTANTS } from "../../shared/types";

/** Clear the persisted battle-active state; presentation cleanup is a post-commit concern. */
export function clearCombatState(draft?: GameplayDraft) {
  if (draft) {
    setHasActiveBattle(draft, false);
    return;
  }
  setHasActiveBattle(false);
}

/** Clear transient combat presentation after the gameplay state has committed. */
export function clearCombatPresentation() {
  useUiStore.getState().clearCardHover();
}

export function awardRunEndMaterials(draft?: GameplayDraft): ReturnType<typeof emptyInventory> {
  if (!draft) return dispatchRunSessionCommand((nextDraft) => awardRunEndMaterials(nextDraft));
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
