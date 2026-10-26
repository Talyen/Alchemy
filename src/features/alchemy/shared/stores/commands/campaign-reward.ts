import { readRewardActivity } from "@/lib/active-run-session";
import type { Immutable } from "immer";
import type { GameplayState } from "../session/gameplay-state-reads";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";
import { STARTER_HOMESTEAD_MATERIAL_TARGET } from "@/lib/game-constants";
import { hasHomesteadPurchases } from "@/lib/homestead/purchases";

/** Preview and claim share one calculation against the current stockpile. */
export function projectCampaignReward(state: Pick<Immutable<GameplayState>, "run" | "runProfile" | "session">) {
  const reward = readRewardActivity(state.session.activity).state;
  const campaignBoss =
    state.run.activeRun.contentSystemType === CONTENT_SYSTEMS.CAMPAIGN &&
    reward.lastVictoryContentSystem === CONTENT_SYSTEMS.CAMPAIGN &&
    reward.lastVictoryEnemyType === "boss";
  const clearedAct = campaignBoss ? state.run.activeRun.currentAct : null;
  const resolvesStarterGrant = clearedAct === 1 && !state.runProfile.starterHomesteadGrantResolved;
  const materials = { ...reward.materials };
  if (resolvesStarterGrant && !hasHomesteadPurchases(state.runProfile)) {
    for (const material of ["wood", "stone"] as const) {
      materials[material] += Math.max(
        0,
        STARTER_HOMESTEAD_MATERIAL_TARGET[material] -
          state.runProfile.materialInventory[material] -
          materials[material],
      );
    }
  }
  return { clearedAct, materials, resolvesStarterGrant };
}
