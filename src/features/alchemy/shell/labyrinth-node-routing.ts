import type { LabyrinthController } from "@/features/alchemy/run-loop/run/labyrinth-controller";
import { presentRunRoomEntry, type RoomPresentation } from "@/features/alchemy/run-loop/run/run-destination-handlers";
import { defaultGameSession } from "@/features/alchemy/shared/stores/default-game-session";
import type { GameSession } from "@/features/alchemy/shared/stores/game-session-types";

interface LabyrinthNodeRoutingDeps extends RoomPresentation {
  labyrinth: Pick<LabyrinthController, "enterSelectedNode">;
}

export function createLabyrinthNodeRouting(
  deps: LabyrinthNodeRoutingDeps,
  gameSession: GameSession = defaultGameSession,
) {
  function handleLabyrinthNodeEnter() {
    const entry = deps.labyrinth.enterSelectedNode();
    if (!entry) return false;
    presentRunRoomEntry(entry, deps, gameSession);
    return true;
  }
  return { handleLabyrinthNodeEnter };
}
