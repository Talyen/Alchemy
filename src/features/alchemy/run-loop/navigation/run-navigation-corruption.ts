// Corruption screen handlers extracted from useRunNavigation.
import { appendUnique } from "@/lib/utils";
import { playUISound } from "@/lib/audio";
import { cardLibrary, type BattleCard } from "@/lib/game-data";
import { corruptDeckCard } from "@/lib/corruption";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { setCorruptionResult } from "@/features/alchemy/shared/stores/run-session-write-port";
import { setDiscoveredCardIds } from "../../shared/stores/profile-port";

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
      setDiscoveredCardIds((current) => appendUnique(current, result.corruptedCard.id));
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
