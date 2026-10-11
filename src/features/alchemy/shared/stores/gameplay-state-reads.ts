import type { GameSession } from "./game-session-types";
import type { GameplayState } from "./gameplay-state";
import { sessionRuntime } from "./session-runtime";
export type { GameplayState } from "./gameplay-state";

export function readGameplayState(gameSession: GameSession): GameplayState {
  return sessionRuntime(gameSession).gameplay.reads.getState();
}

export function subscribeGameplayCommits(listener: (revision: number) => void, gameSession: GameSession): () => void {
  const runtime = sessionRuntime(gameSession);
  return runtime.track(runtime.gameplay.reads.subscribe((state) => listener(state.revision)));
}
