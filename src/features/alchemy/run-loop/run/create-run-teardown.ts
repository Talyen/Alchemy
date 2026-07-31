import { cancelDestinationClaim, releaseRewardClaim } from "@/features/alchemy/shared/stores/run-session-write-port";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { teardownRun } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import { clearBattlePresentationCardGhosts } from "@/features/alchemy/shared/stores/battle-presentation-bridge";
import { CONSTANTS, type Screen } from "@/features/alchemy/shared/types";

export interface RunTeardownDeps {
  cancelPending: () => void;
  setHasActiveBattle: (active: boolean) => void;
  clearCardHover: () => void;
  navigateTo: (nextScreen: Screen, onRenderedScreenCommit?: () => void) => void;
}

/** Cancel in-flight claims, clear presentation, tear down the run, and land on menu. */
export function createRunTeardown(deps: RunTeardownDeps) {
  function resetRunState() {
    dispatchRunSessionCommand(
      () => {
        cancelDestinationClaim();
        releaseRewardClaim();
        deps.setHasActiveBattle(false);
      },
      {
        afterCommit: () => {
          deps.cancelPending();
          clearBattlePresentationCardGhosts();
          deps.clearCardHover();
          deps.navigateTo(CONSTANTS.SCREENS.MENU, () => {
            teardownRun();
          });
        },
      },
    );
  }

  function continueFromRunEnd() {
    deps.clearCardHover();
    resetRunState();
  }

  return { resetRunState, continueFromRunEnd };
}
