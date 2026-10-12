import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { sessionFeedback } from "@/features/alchemy/shared/stores/session-capabilities";
import { readActivityData } from "@/lib/active-run-session";
import { corruptRunCard } from "./corruption-commands";
export interface CorruptionFlowDeps {
  leaveVisit: () => void;
}

export function createCorruptionFlowHandlers(deps: CorruptionFlowDeps, gameSession: GameSession) {
  function handleCorruptCard(cardIndex: number) {
    const activity = readRunSession(gameSession).activity;
    if (activity.kind !== "corruption" || readActivityData(activity, "corruption")) return;
    if (corruptRunCard(cardIndex, gameSession)) sessionFeedback(gameSession).playUISound("musicBoxMystery");
  }

  return { handleCorruptCard, handleCorruptionExit: deps.leaveVisit };
}
