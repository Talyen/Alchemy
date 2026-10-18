import type { LabyrinthController } from "@/features/alchemy/run-loop/run/labyrinth-controller";
import { presentRunRoomEntry, type RoomPresentation } from "@/features/alchemy/run-loop/run/run-destination-handlers";
import type { GameSession } from "@/features/alchemy/shared/stores/game-session-types";

interface LabyrinthNodeRoutingDeps extends RoomPresentation {
  labyrinth: Pick<LabyrinthController, "enterSelectedNode">;
}

export function createLabyrinthNodeRouting(
  { labyrinth, navigateTo, presentBattleStart }: LabyrinthNodeRoutingDeps,
  gameSession: GameSession,
) {
  // Callees already enforce session ownership; this stays a plain closure so
  // node entry pays no capability-graph rebind on every composition.
  function handleLabyrinthNodeEnter() {
    const entry = labyrinth.enterSelectedNode();
    if (!entry) return false;
    presentRunRoomEntry(entry, { navigateTo, presentBattleStart }, gameSession);
    return true;
  }
  return { handleLabyrinthNodeEnter };
}
