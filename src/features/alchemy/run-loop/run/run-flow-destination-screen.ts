import { readRunSession } from "@/features/alchemy/shared/stores/run-session-read-port";
import {
  beginDestinationClaim,
  cancelDestinationClaim,
  commitDestinationClaim,
  setCorruptionResult,
  setRewardState,
  setRunPlayerHealth,
  createDraftRunRandomSource,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { useUiStore } from "../../shared/stores/ui-store";
import { getCampfireHealFraction, getCampfireRestHealth } from "@/lib/game-constants";
import { getBossEnemy, getBossById } from "@/features/alchemy/shared/config";
import { routeDestinationChoice } from "./run-destination-handlers";
import { CONSTANTS, type Destination } from "../../shared/types";
import type { RunFlowHandlerDeps, RunFlowSiblingHandlers } from "./run-flow-handler-deps";

export function createDestinationScreenHandlers(deps: RunFlowHandlerDeps, handlers: RunFlowSiblingHandlers) {
  function prepareDestinationScreen() {
    const state = readRunSession().rewardState;
    const bossOnly = state.destinations.length === 1 && state.destinations[0] === CONSTANTS.DESTINATIONS.BOSS_COMBAT;
    if (!bossOnly) return;
    if (state.selectedBossId && getBossById(state.selectedBossId)) return;
    dispatchRunSessionCommand((draft) => {
      const selectedBossId = getBossEnemy([], createDraftRunRandomSource(draft, "world")).id;
      setRewardState(draft, (prev) => ({ ...prev, selectedBossId }));
    });
  }

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
        afterCommit: () => handlers.advanceToNextDestination(),
      },
    );
  }

  return {
    prepareDestinationScreen,
    handleDestinationChoice,
    handleCampfireContinue,
  };
}
