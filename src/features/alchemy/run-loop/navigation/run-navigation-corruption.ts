import { playUISound } from "@/lib/audio";
import { cardLibrary, type BattleCard } from "@/lib/game-data";
import { corruptDeckCard } from "@/lib/corruption";
import { activeLabyrinthBenefits } from "@/lib/content-systems/labyrinth/room-rules";
import { dispatchRunSessionCommand, type GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import { readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import {
  createDraftRunRandomSource,
  setCorruptionResult,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { discoverCardIds } from "../../shared/stores/profile-store";

function applyCorruptionToDeck(cardIndex: number, updateRunDeck: (draft: GameplayDraft, deck: BattleCard[]) => void) {
  dispatchRunSessionCommand(
    (nextDraft) => {
      const runDeck = nextDraft.run.activeRun.runDeck as BattleCard[];
      const modifiers = activeLabyrinthBenefits(
        nextDraft.run.activeRun.contentSystemType,
        nextDraft.session.activeLabyrinthRewardModifiers,
      );
      const { deck, result } = corruptDeckCard(
        runDeck,
        cardIndex,
        cardLibrary,
        createDraftRunRandomSource(nextDraft, "events"),
        modifiers,
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
  returnToLabyrinthMap?: () => void;
  isLabyrinthRun?: () => boolean;
}

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
    if (deps.isLabyrinthRun?.() && deps.returnToLabyrinthMap) {
      deps.returnToLabyrinthMap();
      return;
    }
    deps.returnToCurrentDestination();
  }

  return { handleCorruptCard, handleCorruptionExit };
}
