import { bindSessionCapabilities } from "@/features/alchemy/shared/stores/session-capabilities";
import type { LabyrinthController } from "@/features/alchemy/run-loop/run/labyrinth-controller";
import { presentRunRoomEntry, type RoomPresentation } from "@/features/alchemy/run-loop/run/run-destination-handlers";
import type { GameSession } from "@/features/alchemy/shared/stores/game-session-types";

interface LabyrinthNodeRoutingDeps extends RoomPresentation {
  labyrinth: Pick<LabyrinthController, "enterSelectedNode">;
}

export function createLabyrinthNodeRouting(input: LabyrinthNodeRoutingDeps, gameSession: GameSession) {
  const deps = bindSessionCapabilities(gameSession, input);
  function handleLabyrinthNodeEnter() {
    const entry = deps.labyrinth.enterSelectedNode();
    if (!entry) return false;
    presentRunRoomEntry(entry, deps, gameSession);
    return true;
  }
  return bindSessionCapabilities(gameSession, { handleLabyrinthNodeEnter });
}
