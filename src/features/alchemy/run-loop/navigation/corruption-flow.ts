import { type GameSession } from "@/features/alchemy/shared/stores/session/game-session-types";
import { readRunSession } from "@/features/alchemy/shared/stores/session/run-reads";
import { sessionFeedback } from "@/features/alchemy/shared/stores/session/session-capabilities";
import { readActivityData } from "@/lib/active-run-session";
import { corruptRunCard } from "./corruption-commands";
export interface CorruptionFlowDeps {
  leaveVisit: () => void;
}

export function createCorruptionFlowHandlers(deps: CorruptionFlowDeps, gameSession: GameSession) {
  function handleCorruptCard(cardIndex: number) {
    const activity = readRunSession(gameSession).activity;
    if (activity.kind !== "corruption" || readActivityData(activity, "corruption")) return;
    if (corruptRunCard(cardIndex, gameSession)) sessionFeedback(gameSession).playUISound("corrupt");
  }

  return { handleCorruptCard, handleCorruptionExit: deps.leaveVisit };
}
