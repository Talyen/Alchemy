// Destination / screen navigation helpers for run-flow shell wiring.
import { useCallback, useMemo } from "react";
import { readHasAnyOwnedGear, readHasUnownedTrinkets } from "@/features/alchemy/shared/stores/gear-store";
import {
  readActiveRun,
  readActiveRunScreen,
  readBattle,
  readHasActiveRun,
  readParkedRuns,
  readRunProfile,
  readRunRecency,
} from "@/features/alchemy/shared/stores/run-session-read-port";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { hydrateModeRunInDraft } from "@/features/alchemy/shared/stores/run-park-restore";
import { mostRecentResumableMode } from "@/features/alchemy/shared/stores/parked-runs";
import { resolveAvailableDestinations, type DestinationOptionsInput } from "@/features/alchemy/shared/run-flow";
import { ROUTE_SCREENS, type Screen } from "@/lib/routing";

export function useRunDestinationWiring({
  navigateTo,
  clearCardHover,
}: {
  navigateTo: (nextScreen: Screen, onRenderedScreenCommit?: () => void) => void;
  clearCardHover: () => void;
}) {
  const getAvailableDestinations = useCallback((options: DestinationOptionsInput = {}) => {
    const active = readActiveRun();
    return resolveAvailableDestinations({
      destinationIndexInAct: active.destinationIndexInAct,
      completedDestinations: active.completedDestinations,
      runPlayerHealth: active.runPlayerHealth,
      runGold: readRunProfile().gold,
      runMaxHealth: active.runMaxHealth,
      hasAnyOwnedGear: readHasAnyOwnedGear(),
      hasUnownedTrinkets: readHasUnownedTrinkets(),
      options,
    });
  }, []);

  const returnToBattle = useCallback(() => {
    const hasLive = readHasActiveRun();
    const liveMode = hasLive ? readActiveRun().contentSystemType : null;
    const parked = readParkedRuns();
    const mode = mostRecentResumableMode(readRunRecency(), liveMode, parked, hasLive);
    if (mode && (!hasLive || liveMode !== mode)) {
      dispatchRunSessionCommand((draft) => {
        hydrateModeRunInDraft(draft, mode);
      });
    }
    if (readBattle().hasActiveBattle) {
      navigateTo(ROUTE_SCREENS.BATTLE);
      return;
    }
    if (readHasActiveRun()) {
      navigateTo(readActiveRunScreen());
    }
  }, [navigateTo]);

  const goToScreen = useCallback(
    (nextScreen: Screen) => {
      clearCardHover();
      navigateTo(nextScreen);
    },
    [clearCardHover, navigateTo],
  );

  return useMemo(
    () => ({ getAvailableDestinations, returnToBattle, goToScreen }),
    [getAvailableDestinations, returnToBattle, goToScreen],
  );
}
