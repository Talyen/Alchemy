import { appendCardToRunWithDiscovery } from "@/features/alchemy/shared/stores/deck-mutations";
import { defaultGameSession } from "@/features/alchemy/shared/stores/default-game-session";
import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import {
  acceptCommand,
  dispatchRunSessionCommand,
  rejectCommand,
  snapshotTransactionValue,
} from "@/features/alchemy/shared/stores/run-session-command";
import {
  createDraftRunRandomSource,
  setPendingCharacterId,
  setRunDeck,
  setRunProgressActivity,
  setWildwoodDraft,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { sessionFeedback } from "@/features/alchemy/shared/stores/session-capabilities";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";
import {
  canCompleteWildwoodDraft,
  canPrepareNextWildwoodBoss,
  enterWildwoodBattle,
  enterWildwoodRemoval,
  offeredWildwoodDraftCard,
  pickWildwoodDraftCard,
  prepareNextWildwoodBoss,
  removeWildwoodCard,
} from "@/lib/content-systems/wildwood/gauntlet";
import { ROUTE_SCREENS } from "@/lib/routing";
export function prepareWildwoodBoss(removeIndex?: number, gameSession: GameSession = defaultGameSession) {
  return dispatchRunSessionCommand(
    (draft) => {
      const state = draft.session.wildwoodDraft;
      const deck = draft.run.activeRun.runDeck;
      if (!state || !canPrepareNextWildwoodBoss(snapshotTransactionValue(state), deck.length))
        return rejectCommand("Wildwood action is unavailable", null);
      const nextDeck =
        removeIndex === undefined
          ? deck
          : removeWildwoodCard(snapshotTransactionValue(state), snapshotTransactionValue(deck), removeIndex);
      if (!nextDeck) return rejectCommand("Wildwood action is unavailable", null);
      const prepared = prepareNextWildwoodBoss(
        snapshotTransactionValue(state),
        deck.length,
        createDraftRunRandomSource(draft, "world"),
      );
      if (!prepared) return rejectCommand("Wildwood action is unavailable", null);
      const battle = enterWildwoodBattle(prepared.state);
      if (!battle) return rejectCommand("Wildwood action is unavailable", null);
      if (removeIndex !== undefined) setRunDeck(draft, nextDeck);
      setWildwoodDraft(draft, battle);
      setRunProgressActivity(draft, ROUTE_SCREENS.BATTLE);
      return acceptCommand({ bossId: prepared.bossId, modifierId: prepared.modifierId });
    },
    undefined,
    gameSession,
  );
}
export function chooseWildwoodDraftCard(cardId: string, gameSession: GameSession = defaultGameSession): void {
  const picked = dispatchRunSessionCommand(
    (draft) => {
      const state = draft.session.wildwoodDraft;
      const activeRun = draft.run.activeRun;
      if (activeRun.contentSystemType !== CONTENT_SYSTEMS.WILDWOOD || !state)
        return rejectCommand("Wildwood action is unavailable", false);
      if (
        !offeredWildwoodDraftCard(snapshotTransactionValue(state), snapshotTransactionValue(activeRun.runDeck), cardId)
      )
        return rejectCommand("Wildwood action is unavailable", false);
      const pick = pickWildwoodDraftCard(
        snapshotTransactionValue(state),
        activeRun.characterId,
        snapshotTransactionValue(activeRun.runDeck),
        cardId,
        createDraftRunRandomSource(draft, "world"),
      );
      if (!pick) return rejectCommand("Wildwood action is unavailable", false);
      appendCardToRunWithDiscovery(draft, pick.card);
      setWildwoodDraft(draft, pick.state);
      return acceptCommand(true);
    },
    undefined,
    gameSession,
  );
  if (picked) sessionFeedback(gameSession).playUISound("draftSelect");
}
export function completeWildwoodDraft(gameSession: GameSession = defaultGameSession): boolean {
  return dispatchRunSessionCommand(
    (draft) => {
      const state = draft.session.wildwoodDraft;
      const runDeck = draft.run.activeRun.runDeck;
      if (!state || !canCompleteWildwoodDraft(snapshotTransactionValue(state), runDeck.length))
        return rejectCommand("Wildwood action is unavailable", false);
      setPendingCharacterId(draft, null);
      return acceptCommand(true);
    },
    undefined,
    gameSession,
  );
}
export function prepareWildwoodRemoval(gameSession: GameSession = defaultGameSession): void {
  dispatchRunSessionCommand(
    (draft) => {
      const current = draft.session.wildwoodDraft;
      if (!current) return rejectCommand("There is no Wildwood draft", undefined);
      const next = enterWildwoodRemoval(snapshotTransactionValue(current));
      if (!next) return rejectCommand("Wildwood removal is unavailable", undefined);
      setWildwoodDraft(draft, next);
      setRunProgressActivity(draft, "wildwood-removal");

      return acceptCommand();
    },
    undefined,
    gameSession,
  );
}
