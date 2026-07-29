// Thin React wiring around createContentSystemNavigation.
/* eslint-disable react-hooks/refs -- factory receives draftedDeckRef for event-time reads */
import { useMemo, useRef } from "react";
import type { BattleCard } from "@/lib/game-data";
import { createContentSystemNavigation } from "@/features/alchemy/run-setup/run/content-system-navigation";
import type { ContentSystemNavigationDeps } from "@/features/alchemy/run-setup/run/content-system-navigation-types";

type ContentSystemNavigationHookDeps = Omit<ContentSystemNavigationDeps, "draftedDeckRef">;

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
  onStartNextWildwoodBoss,
  destinationRng,
  worldRng,
}: ContentSystemNavigationHookDeps) {
  const draftedDeckRef = useRef<BattleCard[] | null>(null);
  return useMemo(
    () =>
      createContentSystemNavigation({
        run,
        talents,
        draftedDeckRef,
        hasActiveRun,
        hasActiveBattle,
        pendingContentSystemType,
        completedDifficulties,
        navigateTo,
        returnToBattle,
        onStartBattle,
        getAvailableDestinations,
        onResumeWildwood,
        onStartNextWildwoodBoss,
        destinationRng,
        worldRng,
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
      onStartNextWildwoodBoss,
      destinationRng,
      worldRng,
    ],
  );
}
