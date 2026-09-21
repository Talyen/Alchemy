import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import {
  addGold,
  beginDestinationClaim,
  cancelDestinationClaim,
  commitDestinationClaim,
  createDraftRunRandomSource,
  setRunPlayerHealth,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { getCampfireHealFraction, getCampfireRestHealth } from "@/lib/campfire-heal";
import { activeLabyrinthBenefits, labyrinthCampfireHealing } from "@/lib/content-systems/labyrinth/room-rules";
import { LABYRINTH_MODIFIER_CONFIG } from "@/lib/game-constants";
import { computeTalentEffects } from "@/lib/game-data";
import { DESTINATIONS, type Destination } from "@/lib/routing";
import { applyAlchemistPotion } from "./reward-commands";

export function claimDestination(destination: Destination) {
  return dispatchRunSessionCommand((draft) => {
    if (!beginDestinationClaim(draft, destination)) return null;
    return {
      selectedBossId: destination === DESTINATIONS.BOSS_COMBAT ? draft.session.rewardFlow.state.selectedBossId : null,
    };
  });
}
export function finishDestinationClaim(destination: Destination) {
  return dispatchRunSessionCommand((draft) => commitDestinationClaim(draft, destination));
}
export function cancelClaimedDestination() {
  dispatchRunSessionCommand((draft) => cancelDestinationClaim(draft));
}
export function restAtCampfire() {
  return dispatchRunSessionCommand((draft) => {
    if (draft.session.activity.kind !== "campfire") return false;
    const talentEffects = computeTalentEffects(draft.runProfile.unlockedTalents);
    const modifiers = activeLabyrinthBenefits(
      draft.run.activeRun.contentSystemType,
      draft.session.activeLabyrinthRewardModifiers,
    );
    const healFraction = labyrinthCampfireHealing(getCampfireHealFraction(talentEffects.campfireHealBonus), modifiers);
    if (modifiers.includes("hidden-purse")) addGold(draft, LABYRINTH_MODIFIER_CONFIG.hiddenPurseGold);
    if (modifiers.includes("herbal-hearth"))
      applyAlchemistPotion({ draft, rng: createDraftRunRandomSource(draft, "rewards") });
    setRunPlayerHealth(draft, (prev) =>
      getCampfireRestHealth(
        prev,
        draft.run.activeRun.runMaxHealth,
        healFraction,
        draft.runProfile.effects.homesteadHealing,
      ),
    );
    return true;
  });
}
