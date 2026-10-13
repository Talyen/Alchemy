import type { GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { sessionFeedback } from "@/features/alchemy/shared/stores/session-capabilities";

/** Shared hover-clear used by every shell navigation path. */
export function clearRunCardHover(gameSession: GameSession): void {
  sessionFeedback(gameSession).clearCardHover();
}
