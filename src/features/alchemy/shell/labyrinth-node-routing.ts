import { assertSessionOwnership, bindSessionCapabilities } from "@/features/alchemy/shared/stores/session-capabilities";
import type { LabyrinthController } from "@/features/alchemy/run-loop/run/labyrinth-controller";
import { presentRunRoomEntry, type RoomPresentation } from "@/features/alchemy/run-loop/run/run-destination-handlers";
import type { GameSession } from "@/features/alchemy/shared/stores/game-session-types";

interface LabyrinthNodeRoutingDeps extends RoomPresentation {
  labyrinth: Pick<LabyrinthController, "enterSelectedNode">;
}

export function createLabyrinthNodeRouting(deps: LabyrinthNodeRoutingDeps, gameSession: GameSession) {
  assertSessionOwnership(gameSession, deps.labyrinth, deps.navigateTo, deps.presentBattleStart);
  function handleLabyrinthNodeEnter() {
    const entry = deps.labyrinth.enterSelectedNode();
    if (!entry) return false;
    presentRunRoomEntry(entry, deps, gameSession);
    return true;
  }
  return bindSessionCapabilities(gameSession, { handleLabyrinthNodeEnter });
}
