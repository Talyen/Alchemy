import {
  beginDestinationClaim,
  cancelDestinationClaim,
  commitDestinationClaim,
  setCorruptionResult,
  setRunPlayerHealth,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { useUiStore } from "../../shared/stores/ui-store";
import { getCampfireHealFraction, getCampfireRestHealth } from "@/lib/game-constants";
import { routeDestinationChoice } from "./run-destination-handlers";
import { CONSTANTS, type Destination } from "../../shared/types";
import type { AdvanceToNextDestination, RunFlowHandlerDeps } from "./run-flow-handler-deps";

interface DestinationCallbacks {
  advanceToNextDestination: AdvanceToNextDestination;
}

export function createDestinationScreenHandlers(
  deps: RunFlowHandlerDeps,
  { advanceToNextDestination }: DestinationCallbacks,
) {
  function handleDestinationChoice(destination: Destination) {
    try {
      const choice = dispatchRunSessionCommand((draft) => {
        if (!beginDestinationClaim(draft, destination)) return null;
        const rewardState = draft.session.rewardState;
        const selectedBossId = destination === CONSTANTS.DESTINATIONS.BOSS_COMBAT ? rewardState.selectedBossId : null;
        return { selectedBossId };
      });
      if (!choice) return;
      useUiStore.getState().clearCardHover();
      const commitDestinationProgress = () => {
        dispatchRunSessionCommand((draft) => commitDestinationClaim(draft, destination));
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
        const healFraction = getCampfireHealFraction(deps.talents.talentEffects.campfireHealBonus);
        setRunPlayerHealth(draft, (prev) => getCampfireRestHealth(prev, deps.run.runMaxHealth, healFraction));
      },
      {
        afterCommit: advanceToNextDestination,
      },
    );
  }

  return {
    handleDestinationChoice,
    handleCampfireContinue,
  };
}
