// Run-navigation session state selectors (run-session + UI stores).
import { useShallow } from "zustand/react/shallow";
import { useUiStore } from "../stores/ui-store";
import { useRunSessionStore } from "../stores/run-session-store";

export function useRunNavigationSession() {
  const session = useRunSessionStore(
    useShallow((s) => ({
      hasActiveRun: s.hasActiveRun,
      labyrinthMap: s.labyrinthMap,
      labyrinthPendingNode: s.activeLabyrinthPendingNode,
      activeLabyrinthModifiers: s.activeLabyrinthModifiers,
      activeLabyrinthRewardModifiers: s.activeLabyrinthRewardModifiers,
      rewardState: s.rewardState,
      runEndMaterials: s.runEndMaterials,
      corruptionResult: s.corruptionResult,
      pendingCharacterId: s.pendingCharacterId,
      pendingContentSystemType: s.pendingContentSystemType,
    })),
  );
  const clearCardHover = useUiStore((s) => s.clearCardHover);

  return { ...session, clearCardHover };
}
