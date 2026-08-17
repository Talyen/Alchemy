// Thin React wiring around createContentSystemNavigation.
import { useMemo } from "react";
import { createContentSystemNavigation } from "@/features/alchemy/run-setup/run/content-system-navigation";
import type { ContentSystemNavigationDeps } from "@/features/alchemy/run-setup/run/content-system-navigation-types";

export function useContentSystemNavigation({
  run,
  talents,
  hasActiveRun,
  hasActiveBattle,
  pendingContentSystemType,
  completedDifficulties,
  navigateTo,
  returnToBattle,
  onStartBattle,
  getAvailableDestinations,
  onResumeWildwood,
  clearCardHover,
}: ContentSystemNavigationDeps) {
  return useMemo(
    () =>
      createContentSystemNavigation({
        run,
        talents,
        hasActiveRun,
        hasActiveBattle,
        pendingContentSystemType,
        completedDifficulties,
        navigateTo,
        returnToBattle,
        onStartBattle,
        getAvailableDestinations,
        onResumeWildwood,
        clearCardHover,
      }),
    [
      run,
      talents,
      hasActiveRun,
      hasActiveBattle,
      pendingContentSystemType,
      completedDifficulties,
      navigateTo,
      returnToBattle,
      onStartBattle,
      getAvailableDestinations,
      onResumeWildwood,
      clearCardHover,
    ],
  );
}
