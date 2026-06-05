// Run-navigation session state via the unified run session read model.
import type { Screen } from "../types";
import { useUiStore } from "../stores/ui-store";
import { useRunSessionNavigationSlice } from "../stores/run-session-facade";

export function useRunNavigationSession(screen: Screen) {
  const nav = useRunSessionNavigationSlice(screen);
  const clearCardHover = useUiStore((s) => s.clearCardHover);

  return {
    phase: nav.phase,
    battle: { hasActiveBattle: nav.hasActiveBattle },
    hasActiveRun: nav.hasActiveRun,
    labyrinthMap: nav.labyrinthMap,
    labyrinthPendingNode: nav.labyrinthPendingNode,
    activeLabyrinthModifiers: nav.activeLabyrinthModifiers,
    activeLabyrinthRewardModifiers: nav.activeLabyrinthRewardModifiers,
    rewardState: nav.rewardState,
    runEndMaterials: nav.runEndMaterials,
    corruptionResult: nav.corruptionResult,
    pendingCharacterId: nav.pendingCharacterId,
    pendingContentSystemType: nav.pendingContentSystemType,
    clearCardHover,
  };
}
