import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type { GameSession } from "../session/game-session-types";
import type { GameplayState } from "../session/gameplay-state";
import { sessionGameplayStore } from "../session/session-gameplay-store";

function useSessionGameplayState<T>(gameSession: GameSession, selector: (state: GameplayState) => T): T {
  return useStore(sessionGameplayStore(gameSession).presentation, selector);
}

export function useSessionHasActiveBattle(gameSession: GameSession): boolean {
  return useSessionGameplayState(gameSession, (state) => state.session.activity.kind === "battle");
}

/** Quote reads refresh the commands without subscribing them to combat snapshots. */
export function useRunControllerState(gameSession: GameSession) {
  const { screen } = useSessionGameplayState(
    gameSession,
    useShallow((state) => ({
      screen: state.run.navigation.screen,
      effects: state.runProfile.effects,
      unlockedTalents: state.runProfile.unlockedTalents,
    })),
  );
  return { screen };
}
