import { type GameSession } from "@/features/alchemy/shared/stores/session/game-session-types";
import { type Destination } from "@/lib/routing";
import { enterRunRoom } from "./room-entry-commands";
import { presentRunRoomEntry } from "./run-destination-handlers";
import type { AdvanceToNextDestination, RunFlowHandlerDeps } from "./run-flow";

export function createDestinationScreenHandlers(
  deps: RunFlowHandlerDeps,
  advanceToNextDestination: AdvanceToNextDestination,
  gameSession: GameSession,
) {
  function handleDestinationChoice(destination: Destination) {
    const entry = enterRunRoom({ kind: "campaign", destination }, gameSession);
    if (!entry) return;
    deps.actions.clearCardHover();
    presentRunRoomEntry(entry, deps.actions, gameSession);
  }

  function handleCampfireContinue() {
    advanceToNextDestination("campfire");
  }

  return {
    handleDestinationChoice,
    handleCampfireContinue,
  };
}
