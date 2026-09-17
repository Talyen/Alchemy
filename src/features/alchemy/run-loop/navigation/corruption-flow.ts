import { readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import {
  createDraftRunRandomSource,
  setCorruptionResult,
  setRunDeck,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { readActivityData } from "@/lib/active-run-session";
import { playUISound } from "@/lib/audio";
import { activeLabyrinthBenefits } from "@/lib/content-systems/labyrinth/room-rules";
import { corruptDeckCard } from "@/lib/corruption";
import { cardLibrary, type BattleCard } from "@/lib/game-data";
import { discoverCardIds } from "../../shared/stores/profile-store";

function applyCorruptionToDeck(cardIndex: number) {
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
        // Shared "events" stream with mystery: keep sharing so sequential draws
        // stay deterministic for saves (see mystery-event-navigation).
        createDraftRunRandomSource(nextDraft, "events"),
        modifiers,
      );
      if (!result) return null;
      setRunDeck(nextDraft, deck);
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
  advanceToNextDestination: () => void;
  returnToCurrentDestination: () => void;
  returnToLabyrinthMap?: () => void;
  isLabyrinthRun?: () => boolean;
}

export function createCorruptionFlowHandlers(deps: CorruptionFlowDeps) {
  function handleCorruptCard(cardIndex: number) {
    const activity = readRunSession().activity;
    if (activity.kind !== "corruption" || readActivityData(activity, "corruption")) return;
    applyCorruptionToDeck(cardIndex);
  }

  function handleCorruptionExit() {
    if (readActivityData(readRunSession().activity, "corruption")) {
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
