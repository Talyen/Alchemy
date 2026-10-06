import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { type Destination } from "@/lib/routing";
import { restAtCampfire } from "./destination-commands";
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
    const activity = readRunSession(gameSession).activity;
    if (activity.kind !== "campfire") return;
    if (activity.data.completed || restAtCampfire(gameSession)) advanceToNextDestination();
  }

  return {
    handleDestinationChoice,
    handleCampfireContinue,
  };
}
