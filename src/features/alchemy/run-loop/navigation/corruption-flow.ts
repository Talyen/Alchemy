import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { sessionFeedback } from "@/features/alchemy/shared/stores/session-capabilities";
import { readActivityData } from "@/lib/active-run-session";
import { corruptRunCard } from "./corruption-commands";
export interface CorruptionFlowDeps {
  advanceToNextDestination: () => void;
  returnToCurrentDestination: () => void;
  returnToLabyrinthMap?: () => void;
  isLabyrinthRun?: () => boolean;
}

export function createCorruptionFlowHandlers(deps: CorruptionFlowDeps, gameSession: GameSession) {
  function handleCorruptCard(cardIndex: number) {
    const activity = readRunSession(gameSession).activity;
    if (activity.kind !== "corruption" || readActivityData(activity, "corruption")) return;
    if (corruptRunCard(cardIndex, gameSession)) sessionFeedback(gameSession).playUISound("musicBoxMystery");
  }

  function handleCorruptionExit() {
    if (readActivityData(readRunSession(gameSession).activity, "corruption")) {
      deps.advanceToNextDestination();
      return;
    }
    if (deps.isLabyrinthRun?.() && deps.returnToLabyrinthMap) {
      deps.returnToLabyrinthMap();
      return;
    }
    deps.returnToCurrentDestination();
  }

  return { handleCorruptCard, handleCorruptionExit };
}
