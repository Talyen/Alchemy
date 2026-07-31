import {
  readRunSessionStore,
  beginDestinationClaim,
  cancelDestinationClaim,
  commitDestinationClaim,
  dispatchRunSessionCommand,
  setCorruptionResult,
  setRewardState,
} from "../../shared/stores/run-session-facade";
import { useUiStore } from "../../shared/stores/ui-store";
import { getCampfireHealFraction, getCampfireRestHealth } from "@/lib/game-constants";
import { getBossEnemy, getBossById } from "@/features/alchemy/shared/config";
import { routeDestinationChoice } from "./run-destination-handlers";
import { CONSTANTS, type Destination } from "../../shared/types";
import type { RunFlowContext } from "./run-flow-context";

export function createDestinationScreenHandlers(ctx: RunFlowContext) {
  const { deps } = ctx;

  function prepareDestinationScreen() {
    const state = readRunSessionStore().rewardState;
    const bossOnly = state.destinations.length === 1 && state.destinations[0] === CONSTANTS.DESTINATIONS.BOSS_COMBAT;
    if (!bossOnly) return;
    if (state.selectedBossId && getBossById(state.selectedBossId)) return;
    setRewardState((prev) => ({ ...prev, selectedBossId: getBossEnemy([], deps.worldRng).id }));
  }

  function handleDestinationChoice(destination: Destination) {
    try {
      const choice = dispatchRunSessionCommand(() => {
        if (!beginDestinationClaim(destination)) return null;
        const rewardState = readRunSessionStore().rewardState;
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
          // Mystery owns its navigateTo; commit the offer surface before starting.
          commitDestinationProgress();
          deps.dispatch({ type: "begin-mystery-event" });
        },
        resetCorruption: () => setCorruptionResult(null),
        startShop: () => deps.dispatch({ type: "init-shop" }),
        startAlchemist: () => deps.dispatch({ type: "init-alchemist" }),
        startTrinketShop: () => deps.dispatch({ type: "init-trinket-shop" }),
        startEquipmentShop: () => deps.dispatch({ type: "init-equipment-shop" }),
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
        deps.run.setRunPlayerHealth((prev) => getCampfireRestHealth(prev, deps.run.runMaxHealth, healFraction));
      },
      {
        afterCommit: () => ctx.dispatchContinuation({ type: "advance-to-next-destination" }),
      },
    );
  }

  return {
    prepareDestinationScreen,
    handleDestinationChoice,
    handleCampfireContinue,
  };
}
