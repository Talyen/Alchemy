import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type { GameSession } from "./game-session-types";
import type { GameplayState } from "./gameplay-state";
import { sessionGameplayStore } from "./session-gameplay-store";

function useSessionGameplayState<T>(gameSession: GameSession, selector: (state: GameplayState) => T): T {
  return useStore(sessionGameplayStore(gameSession).presentation, selector);
}

export function useSessionHasActiveBattle(gameSession: GameSession): boolean {
  return useSessionGameplayState(gameSession, (state) => state.session.activity.kind === "battle");
}

/** Quote reads refresh the commands without subscribing them to combat snapshots. */
export function useRunControllerState(gameSession: GameSession) {
  useSessionGameplayState(
    gameSession,
    useShallow((state) => state.runProfile.effects),
  );
  useSessionGameplayState(
    gameSession,
    useShallow((state) => state.runProfile.unlockedTalents),
  );
  return useSessionGameplayState(
    gameSession,
    useShallow((state) => ({
      screen: state.run.navigation.screen,
    })),
  );
}
