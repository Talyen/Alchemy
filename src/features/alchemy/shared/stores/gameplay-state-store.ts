import { useStore } from "zustand";
import { defaultGameSession } from "./default-game-session";
import type { GameSession } from "./game-session-types";
import type { GameplayState } from "./gameplay-state";
import { sessionRuntime } from "./session-runtime";
export type { GameplayState } from "./gameplay-state";

const applicationStore = sessionRuntime(defaultGameSession).gameplay;
export const useGameplayStateStore = Object.assign(
  <T>(selector: (state: GameplayState) => T): T => useStore(applicationStore, selector),
  applicationStore,
);

export function readGameplayState(gameSession: GameSession = defaultGameSession): GameplayState {
  return sessionRuntime(gameSession).gameplay.getState();
}

export function subscribeGameplayCommits(
  listener: (revision: number) => void,
  gameSession: GameSession = defaultGameSession,
): () => void {
  const runtime = sessionRuntime(gameSession);
  return runtime.track(runtime.gameplay.subscribe((state) => listener(state.revision)));
}
