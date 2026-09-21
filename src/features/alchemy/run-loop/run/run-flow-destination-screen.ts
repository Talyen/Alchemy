import { resetCorruptionVisit } from "@/features/alchemy/shared/stores/navigation-commands";
import { type Destination } from "@/lib/routing";
import { logError } from "@/lib/error-logger";
import { routeDestinationChoice } from "./run-destination-handlers";
import type { AdvanceToNextDestination, RunFlowHandlerDeps } from "./run-flow";
import {
  claimDestination,
  finishDestinationClaim,
  cancelClaimedDestination,
  restAtCampfire,
} from "./destination-commands";

export function createDestinationScreenHandlers(
  deps: RunFlowHandlerDeps,
  advanceToNextDestination: AdvanceToNextDestination,
) {
  function safeCancelDestinationClaim(where: string, destination: Destination) {
    try {
      cancelClaimedDestination();
    } catch (rollbackError) {
      logError("cancelDestinationClaim failed", "other", {
        where,
        destination,
        rollbackError: String(rollbackError),
        stack: rollbackError instanceof Error ? rollbackError.stack : undefined,
      });
    }
  }

  function handleDestinationChoice(destination: Destination) {
    try {
      const choice = claimDestination(destination);
      if (!choice) return;
      deps.actions.clearCardHover();
      // Prepare-then-commit: shop/battle/mystery setup runs before the
      // destination-claim commit, which is deferred into navigateTo's
      // prepareNavigation. Setup must therefore not read claim state.
      const commitDestinationProgress = () => {
        try {
          const committed = finishDestinationClaim(destination);
          if (!committed) throw new Error("commitDestinationProgress failed");
        } catch (error) {
          safeCancelDestinationClaim("commit", destination);
          logError("commitDestinationProgress failed", "other", {
            destination,
            error: String(error),
            stack: error instanceof Error ? error.stack : undefined,
          });
          throw new Error("commitDestinationProgress failed", { cause: error });
        }
      };
      routeDestinationChoice(destination, {
        navigateTo: (screen) => deps.actions.navigateTo(screen, commitDestinationProgress),
        beginMysteryEvent: () => deps.actions.beginMysteryEvent(commitDestinationProgress),
        initializeShop: deps.actions.initializeShop,
        startBattle: deps.actions.startBattle,
        startBoss: (opts) => deps.actions.startBoss({ ...opts, bossId: choice.selectedBossId }),
        resetCorruption: resetCorruptionVisit,
      });
    } catch (error) {
      safeCancelDestinationClaim("choice", destination);
      throw error;
    }
  }

  function handleCampfireContinue() {
    if (restAtCampfire()) advanceToNextDestination();
  }

  return {
    handleDestinationChoice,
    handleCampfireContinue,
  };
}
