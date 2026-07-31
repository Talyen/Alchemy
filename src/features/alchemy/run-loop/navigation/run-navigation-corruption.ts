// Corruption screen handlers extracted from useRunNavigation.
import { appendUnique } from "@/lib/utils";
import { playUISound } from "@/lib/audio";
import { cardLibrary, type BattleCard } from "@/lib/game-data";
import { corruptDeckCard } from "@/lib/corruption";
import { dispatchRunSessionCommand, setCorruptionResult } from "../../shared/stores/run-session-facade";
import { useProfileStore } from "../../shared/stores/profile-store";

function applyCorruptionToDeck(
  runDeck: BattleCard[],
  cardIndex: number,
  rng: () => number,
  setRunDeck: (deck: BattleCard[]) => void,
) {
  dispatchRunSessionCommand(
    () => {
      const { deck, result } = corruptDeckCard(runDeck, cardIndex, cardLibrary, rng);
      setRunDeck(deck);
      setCorruptionResult(result);
      useProfileStore.getState().setDiscoveredCardIds((current) => appendUnique(current, result.corruptedCard.id));
      return result;
    },
    { afterCommit: () => playUISound("musicBoxMystery") },
  );
}

export interface CorruptionFlowDeps {
  getRunDeck: () => BattleCard[];
  setRunDeck: (deck: BattleCard[]) => void;
  eventsRng: () => number;
  advanceToNextDestination: () => void;
}

/** Corruption screen commands: apply a corrupt pick, then advance when exiting. */
export function createCorruptionFlowHandlers(deps: CorruptionFlowDeps) {
  function handleCorruptCard(cardIndex: number) {
    applyCorruptionToDeck(deps.getRunDeck(), cardIndex, deps.eventsRng, deps.setRunDeck);
  }

  function handleCorruptionExit() {
    deps.advanceToNextDestination();
  }

  return { handleCorruptCard, handleCorruptionExit };
}
