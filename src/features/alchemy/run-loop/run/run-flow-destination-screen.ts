import { readRunSession } from "@/features/alchemy/shared/stores/run-session-read-port";
import {
  beginDestinationClaim,
  cancelDestinationClaim,
  commitDestinationClaim,
  setCorruptionResult,
  setRewardState,
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
    dispatchRunSessionCommand(() => {
      const selectedBossId = getBossEnemy([], deps.worldRng).id;
      setRewardState((prev) => ({ ...prev, selectedBossId }));
    });
  }

  function handleDestinationChoice(destination: Destination) {
    try {
      const choice = dispatchRunSessionCommand(() => {
        if (!beginDestinationClaim(destination)) return null;
        const rewardState = readRunSession().rewardState;
        const selectedBossId = destination === CONSTANTS.DESTINATIONS.BOSS_COMBAT ? rewardState.selectedBossId : null;
        return { selectedBossId };
      });
      if (!choice) return;
      useUiStore.getState().clearCardHover();
      const commitDestinationProgress = () => {
        commitDestinationClaim(destination);
      };
      routeDestinationChoice(destination, {
        navigateTo: (screen) =>
          deps.dispatch({
            type: "navigate",
            screen,
            onRenderedScreenCommit: commitDestinationProgress,
          }),
        beginMysteryEvent: () => {
          deps.dispatch({
            type: "begin-mystery-event",
            onRenderedScreenCommit: commitDestinationProgress,
          });
        },
        resetCorruption: () => setCorruptionResult(null),
        startShop: () => deps.dispatch({ type: "init-shop", kind: "shop" }),
        startAlchemist: () => deps.dispatch({ type: "init-shop", kind: "alchemist" }),
        startTrinketShop: () => deps.dispatch({ type: "init-shop", kind: "trinket" }),
        startEquipmentShop: () => deps.dispatch({ type: "init-shop", kind: "equipment" }),
        startBattle: (enemyType) => deps.dispatch({ type: "start-battle", enemyType }),
        startBossBattle: () => deps.dispatch({ type: "start-boss", bossId: choice.selectedBossId }),
      });
    } catch (error) {
      dispatchRunSessionCommand(() => cancelDestinationClaim());
      throw error;
    }
  }

  function handleCampfireContinue() {
    dispatchRunSessionCommand(
      () => {
        const healFraction = getCampfireHealFraction(deps.talents.talentEffects.campfireHealBonus);
        deps.run.updateRunPlayerHealth((prev) => getCampfireRestHealth(prev, deps.run.runMaxHealth, healFraction));
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
