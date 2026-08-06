// Corruption screen handlers used by useRunFlowEngine.
import { appendUnique } from "@/lib/utils";
import { playUISound } from "@/lib/audio";
import { cardLibrary, type BattleCard } from "@/lib/game-data";
import { corruptDeckCard } from "@/lib/corruption";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { setCorruptionResult } from "@/features/alchemy/shared/stores/run-session-write-port";
import { setDiscoveredCardIds } from "../../shared/stores/profile-store";

function applyCorruptionToDeck(
  runDeck: BattleCard[],
  cardIndex: number,
  rng: () => number,
  updateRunDeck: (deck: BattleCard[]) => void,
) {
  dispatchRunSessionCommand(
    () => {
      const { deck, result } = corruptDeckCard(runDeck, cardIndex, cardLibrary, rng);
      updateRunDeck(deck);
      setCorruptionResult(result);
      setDiscoveredCardIds((current) => appendUnique(current, result.corruptedCard.id));
      return result;
    },
    { afterCommit: () => playUISound("musicBoxMystery") },
  );
}

export interface CorruptionFlowDeps {
  getRunDeck: () => BattleCard[];
  updateRunDeck: (deck: BattleCard[]) => void;
  eventsRng: () => number;
  advanceToNextDestination: () => void;
}

/** Corruption screen commands: apply a corrupt pick, then advance when exiting. */
export function createCorruptionFlowHandlers(deps: CorruptionFlowDeps) {
  function handleCorruptCard(cardIndex: number) {
    applyCorruptionToDeck(deps.getRunDeck(), cardIndex, deps.eventsRng, deps.updateRunDeck);
  }

  function handleCorruptionExit() {
    deps.advanceToNextDestination();
  }

  return { handleCorruptCard, handleCorruptionExit };
}
