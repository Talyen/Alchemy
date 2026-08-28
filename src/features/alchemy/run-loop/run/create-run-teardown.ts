import {
  cancelDestinationClaim,
  releaseRewardClaim,
  setHasActiveBattle,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { clearBattlePresentationUi, teardownRun } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import { ROUTE_SCREENS, type Screen } from "@/lib/routing";

export interface RunTeardownDeps {
  cancelPending: () => void;
  clearCardHover: () => void;
  navigateTo: (nextScreen: Screen, onRenderedScreenCommit?: () => void) => void;
}

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
          clearBattlePresentationUi();
          deps.clearCardHover();
          deps.navigateTo(ROUTE_SCREENS.MENU, () => {
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
