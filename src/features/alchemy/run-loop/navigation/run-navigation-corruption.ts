// Corruption screen handlers used by useRunFlowEngine.
import { appendUnique } from "@/lib/utils";
import { playUISound } from "@/lib/audio";
import { cardLibrary, type BattleCard } from "@/lib/game-data";
import { corruptDeckCard } from "@/lib/corruption";
import { dispatchRunSessionCommand, type GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import {
  createDraftRunRandomSource,
  setCorruptionResult,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { setDiscoveredCardIds } from "../../shared/stores/profile-store";

function applyCorruptionToDeck(
  runDeck: BattleCard[],
  cardIndex: number,
  updateRunDeck: (draft: GameplayDraft, deck: BattleCard[]) => void,
) {
  dispatchRunSessionCommand(
    (nextDraft) => {
      const { deck, result } = corruptDeckCard(
        runDeck,
        cardIndex,
        cardLibrary,
        createDraftRunRandomSource(nextDraft, "events"),
      );
      updateRunDeck(nextDraft, deck);
      setCorruptionResult(nextDraft, result);
      setDiscoveredCardIds(nextDraft, (current) => appendUnique(current, result.corruptedCard.id));
      return result;
    },
    { afterCommit: () => playUISound("musicBoxMystery") },
  );
}

export interface CorruptionFlowDeps {
  getRunDeck: () => BattleCard[];
  updateRunDeck: (draft: GameplayDraft, deck: BattleCard[]) => void;
  advanceToNextDestination: () => void;
}

/** Corruption screen commands: apply a corrupt pick, then advance when exiting. */
export function createCorruptionFlowHandlers(deps: CorruptionFlowDeps) {
  function handleCorruptCard(cardIndex: number) {
    applyCorruptionToDeck(deps.getRunDeck(), cardIndex, deps.updateRunDeck);
  }

  function handleCorruptionExit() {
    deps.advanceToNextDestination();
  }

  return { handleCorruptCard, handleCorruptionExit };
}
