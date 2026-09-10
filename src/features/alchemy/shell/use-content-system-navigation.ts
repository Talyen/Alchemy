import { useMemo } from "react";
import { createContentSystemNavigation } from "@/features/alchemy/run-setup/run/content-system-navigation";
import type { ContentSystemNavigationDeps } from "@/features/alchemy/run-setup/run/content-system-navigation-types";

export function useContentSystemNavigation({
  navigateTo,
  onStartBattle,
  getAvailableDestinations,
  onResumeWildwood,
  clearCardHover,
}: ContentSystemNavigationDeps) {
  return useMemo(
    () =>
      createContentSystemNavigation({
        navigateTo,
        onStartBattle,
        getAvailableDestinations,
        onResumeWildwood,
        clearCardHover,
      }),
    [navigateTo, onStartBattle, getAvailableDestinations, onResumeWildwood, clearCardHover],
  );
}
