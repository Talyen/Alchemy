import { appendCardToRunWithDiscovery } from "@/features/alchemy/shared/stores/deck-mutations";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import {
  addGold,
  beginDestinationClaim,
  cancelDestinationClaim,
  commitDestinationClaim,
  createDraftRunRandomSource,
  setCorruptionResult,
  setRunPlayerHealth,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { getCampfireHealFraction, getCampfireRestHealth } from "@/lib/campfire-heal";
import { activeLabyrinthBenefits, labyrinthCampfireHealing } from "@/lib/content-systems/labyrinth/room-rules";
import { LABYRINTH_MODIFIER_CONFIG } from "@/lib/game-constants";
import { computeTalentEffects } from "@/lib/game-data";
import { DESTINATIONS, type Destination } from "@/lib/routing";
import { getRandomPotionCard } from "../navigation/reward-flow";
import { routeDestinationChoice } from "./run-destination-handlers";
import type { AdvanceToNextDestination, RunFlowHandlerDeps } from "./run-flow";

export function createDestinationScreenHandlers(
  deps: RunFlowHandlerDeps,
  advanceToNextDestination: AdvanceToNextDestination,
) {
  function handleDestinationChoice(destination: Destination) {
    try {
      const choice = dispatchRunSessionCommand((draft) => {
        if (!beginDestinationClaim(draft, destination)) return null;
        const rewardState = draft.session.rewardFlow.state;
        const selectedBossId = destination === DESTINATIONS.BOSS_COMBAT ? rewardState.selectedBossId : null;
        return { selectedBossId };
      });
      if (!choice) return;
      deps.actions.clearCardHover();
      const commitDestinationProgress = () => {
        try {
          const committed = dispatchRunSessionCommand((draft) => commitDestinationClaim(draft, destination));
          if (!committed) throw new Error("commitDestinationProgress failed");
        } catch (error) {
          try {
            dispatchRunSessionCommand((draft) => cancelDestinationClaim(draft));
          } catch {}
          throw new Error("commitDestinationProgress failed", { cause: error });
        }
      };
      routeDestinationChoice(destination, {
        navigateTo: (screen) => deps.actions.navigateTo(screen, commitDestinationProgress),
        beginMysteryEvent: () => deps.actions.beginMysteryEvent(commitDestinationProgress),
        initializeShop: deps.actions.initializeShop,
        startBattle: deps.actions.startBattle,
        startBoss: (opts) => deps.actions.startBoss({ ...opts, bossId: choice.selectedBossId }),
        resetCorruption: () => dispatchRunSessionCommand((draft) => setCorruptionResult(draft, null)),
      });
    } catch (error) {
      dispatchRunSessionCommand((draft) => cancelDestinationClaim(draft));
      throw error;
    }
  }

  function handleCampfireContinue() {
    dispatchRunSessionCommand(
      (draft) => {
        if (draft.session.activity.kind !== "campfire") return false;
        const talentEffects = computeTalentEffects(draft.runProfile.unlockedTalents);
        const modifiers = activeLabyrinthBenefits(
          draft.run.activeRun.contentSystemType,
          draft.session.activeLabyrinthRewardModifiers,
        );
        const healFraction = labyrinthCampfireHealing(
          getCampfireHealFraction(talentEffects.campfireHealBonus),
          modifiers,
        );
        if (modifiers.includes("hidden-purse")) addGold(draft, LABYRINTH_MODIFIER_CONFIG.hiddenPurseGold);
        if (modifiers.includes("herbal-hearth"))
          appendCardToRunWithDiscovery(draft, getRandomPotionCard(createDraftRunRandomSource(draft, "rewards")));
        setRunPlayerHealth(draft, (prev) =>
          getCampfireRestHealth(prev, draft.run.activeRun.runMaxHealth, healFraction),
        );
        return true;
      },
      {
        afterCommit: (continued) => {
          if (continued) advanceToNextDestination();
        },
      },
    );
  }

  return {
    handleDestinationChoice,
    handleCampfireContinue,
  };
}
