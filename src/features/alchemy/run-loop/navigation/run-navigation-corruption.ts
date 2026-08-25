// Corruption screen handlers used by useRunFlowEngine.
import { playUISound } from "@/lib/audio";
import { cardLibrary, type BattleCard } from "@/lib/game-data";
import { corruptDeckCard } from "@/lib/corruption";
import { dispatchRunSessionCommand, type GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import { readRunSession } from "@/features/alchemy/shared/stores/run-session-read-port";
import {
  createDraftRunRandomSource,
  setCorruptionResult,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { discoverCardIds } from "../run/deck-mutations";

function applyCorruptionToDeck(cardIndex: number, updateRunDeck: (draft: GameplayDraft, deck: BattleCard[]) => void) {
  dispatchRunSessionCommand(
    (nextDraft) => {
      const runDeck = nextDraft.run.activeRun.runDeck as BattleCard[];
      const { deck, result } = corruptDeckCard(
        runDeck,
        cardIndex,
        cardLibrary,
        createDraftRunRandomSource(nextDraft, "events"),
      );
      if (!result) return null;
      updateRunDeck(nextDraft, deck);
      setCorruptionResult(nextDraft, result);
      discoverCardIds(nextDraft, [result.corruptedCard.id]);
      return result;
    },
    {
      afterCommit: (result) => {
        if (result) playUISound("musicBoxMystery");
      },
    },
  );
}

export interface CorruptionFlowDeps {
  updateRunDeck: (draft: GameplayDraft, deck: BattleCard[]) => void;
  advanceToNextDestination: () => void;
  returnToCurrentDestination: () => void;
}

/** Corruption screen commands: apply a corrupt pick, then advance or restore the picker on exit. */
export function createCorruptionFlowHandlers(deps: CorruptionFlowDeps) {
  function handleCorruptCard(cardIndex: number) {
    if (readRunSession().corruptionResult) return;
    applyCorruptionToDeck(cardIndex, deps.updateRunDeck);
  }

  function handleCorruptionExit() {
    if (readRunSession().corruptionResult) {
      deps.advanceToNextDestination();
      return;
    }
    deps.returnToCurrentDestination();
  }

  return { handleCorruptCard, handleCorruptionExit };
}
