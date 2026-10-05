import { defaultGameSession } from "@/features/alchemy/shared/stores/default-game-session";
import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { resetCorruptionVisit } from "@/features/alchemy/shared/stores/navigation-commands";
import { readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { logError } from "@/lib/error-logger";
import { type Destination } from "@/lib/routing";
import {
  cancelClaimedDestination,
  claimDestination,
  finishDestinationClaim,
  restAtCampfire,
} from "./destination-commands";
import { routeDestinationChoice } from "./run-destination-handlers";
import type { AdvanceToNextDestination, RunFlowHandlerDeps } from "./run-flow";

export function createDestinationScreenHandlers(
  deps: RunFlowHandlerDeps,
  advanceToNextDestination: AdvanceToNextDestination,
  gameSession: GameSession = defaultGameSession,
) {
  function safeCancelDestinationClaim(where: string, destination: Destination) {
    try {
      cancelClaimedDestination(gameSession);
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
      const choice = claimDestination(destination, gameSession);
      if (!choice) return;
      deps.actions.clearCardHover();
      // Prepare-then-commit: shop/battle/mystery setup runs before the
      // destination-claim commit, which is deferred into navigateTo's
      // prepareNavigation. Setup must therefore not read claim state.
      const commitDestinationProgress = () => {
        try {
          const committed = finishDestinationClaim(destination, gameSession);
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
      routeDestinationChoice(
        destination,
        {
          navigateTo: (screen) => deps.actions.navigateTo(screen, commitDestinationProgress),
          beginMysteryEvent: () => deps.actions.beginMysteryEvent(commitDestinationProgress),
          initializeShop: deps.actions.initializeShop,
          startBattle: deps.actions.startBattle,
          startBoss: (opts) => deps.actions.startBoss({ ...opts, bossId: choice.selectedBossId }),
          resetCorruption: () => resetCorruptionVisit(gameSession),
        },
        gameSession,
      );
    } catch (error) {
      safeCancelDestinationClaim("choice", destination);
      throw error;
    }
  }

  function handleCampfireContinue() {
    const activity = readRunSession(gameSession).activity;
    if (activity.kind !== "campfire") return;
    if (activity.data.completed || restAtCampfire(gameSession)) advanceToNextDestination();
  }

  return {
    handleDestinationChoice,
    handleCampfireContinue,
  };
}
