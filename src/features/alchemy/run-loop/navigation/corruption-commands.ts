import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import {
  createDraftRunRandomSource,
  setCorruptionResult,
  setRunDeck,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { activeLabyrinthBenefits } from "@/lib/content-systems/labyrinth/room-rules";
import { corruptDeckCard } from "@/lib/corruption";
import { cardLibrary, type BattleCard } from "@/lib/game-data";
import { discoverCardIds } from "../../shared/stores/profile-store";

export function corruptRunCard(cardIndex: number) {
  return dispatchRunSessionCommand((nextDraft) => {
    if (nextDraft.session.activity.kind !== "corruption" || nextDraft.session.activity.data) return null;

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
  });
}
