import {
  cancelDestinationClaim,
  releaseRewardClaim,
  setHasActiveBattle,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { teardownRun } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import { useBattlePresentationStore } from "../battle/battle-presentation-store";
import { CONSTANTS, type Screen } from "@/features/alchemy/shared/types";

export interface RunTeardownDeps {
  cancelPending: () => void;
  clearCardHover: () => void;
  navigateTo: (nextScreen: Screen, onRenderedScreenCommit?: () => void) => void;
}

/** Cancel in-flight claims, clear presentation, tear down the run, and land on menu. */
export function createRunTeardown(deps: RunTeardownDeps) {
  function resetRunState() {
    dispatchRunSessionCommand(
      (draft) => {
        cancelDestinationClaim(draft);
        releaseRewardClaim(draft);
        setHasActiveBattle(draft, false);
      },
      {
        afterCommit: () => {
          deps.cancelPending();
          useBattlePresentationStore.getState().resetPresentation();
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
