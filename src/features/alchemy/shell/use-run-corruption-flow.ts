// Thin React wiring around createCorruptionFlowHandlers.
import { useMemo } from "react";
import {
  createCorruptionFlowHandlers,
  type CorruptionFlowDeps,
} from "@/features/alchemy/run-loop/navigation/run-navigation-corruption";

export function useRunCorruptionFlow({
  getRunDeck,
  setRunDeck,
  eventsRng,
  advanceToNextDestination,
}: CorruptionFlowDeps) {
  return useMemo(
    () =>
      createCorruptionFlowHandlers({
        getRunDeck,
        setRunDeck,
        eventsRng,
        advanceToNextDestination,
      }),
    [getRunDeck, setRunDeck, eventsRng, advanceToNextDestination],
  );
}
