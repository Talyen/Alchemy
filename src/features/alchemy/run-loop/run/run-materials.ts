import type { GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import {
  addMaterials,
  clearRunMaterialsEarned,
  setRunEndMaterials,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { CONTENT_SYSTEMS, type ContentSystemId } from "@/lib/content-systems/types";
import { addInventory, emptyInventory } from "@/lib/homestead/inventory";
import { applyEndOfRunHomesteadBonuses } from "@/lib/homestead/loot";

/**
 * Single owner for the "Wildwood awards no materials" rule. The gauntlet has
 * its own economy, so both the during-run award gate and the end-of-run
 * settlement exclude it here. (The Wildwood-only reward/victory branches in
 * `navigation/reward-flow.ts` and `navigation/victory-flow.ts` are routing,
 * not award policy, and intentionally bypass materials altogether.)
 */
export function awardsRunMaterialsFor(contentSystemType: ContentSystemId): boolean {
  return contentSystemType !== CONTENT_SYSTEMS.WILDWOOD;
}

export function awardRunEndMaterials(draft: GameplayDraft): ReturnType<typeof emptyInventory> {
  const runState = draft.run.activeRun;
  const runProfile = draft.runProfile;
  if (!awardsRunMaterialsFor(runState.contentSystemType)) {
    clearRunMaterialsEarned(draft);
    const none = emptyInventory();
    setRunEndMaterials(draft, none);
    return none;
  }
  const runCollected = runState.runMaterialsEarned;
  const homesteadBonus = applyEndOfRunHomesteadBonuses(emptyInventory(), runProfile.effects, runState.roomsEncountered);
  addMaterials(draft, homesteadBonus);
  setRunEndMaterials(draft, addInventory(runCollected, homesteadBonus));
  clearRunMaterialsEarned(draft);
  return homesteadBonus;
}
