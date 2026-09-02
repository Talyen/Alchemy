import { useMemo } from "react";
import { createContentSystemNavigation } from "@/features/alchemy/run-setup/run/content-system-navigation";
import type { ContentSystemNavigationDeps } from "@/features/alchemy/run-setup/run/content-system-navigation-types";

export function useContentSystemNavigation({
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
        navigateTo,
        returnToBattle,
        onStartBattle,
        getAvailableDestinations,
        onResumeWildwood,
        clearCardHover,
      }),
    [navigateTo, returnToBattle, onStartBattle, getAvailableDestinations, onResumeWildwood, clearCardHover],
  );
}
