import { appendCardToRunWithDiscovery } from "@/features/alchemy/shared/stores/deck-mutations";
import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import {
  acceptCommand,
  dispatchRunSessionCommand,
  rejectCommand,
  snapshotTransactionValue,
  type RunTransaction,
} from "@/features/alchemy/shared/stores/run-session-command";
import {
  createDraftRunRandomSource,
  initializeBattle,
  setPendingCharacterId,
  setRunDeck,
  setWildwoodDraft,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { sessionFeedback } from "@/features/alchemy/shared/stores/session-capabilities";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";
import {
  canCompleteWildwoodDraft,
  canPrepareNextWildwoodBoss,
  enterWildwoodBattle,
  offeredWildwoodDraftCard,
  pickWildwoodDraftCard,
  prepareNextWildwoodBoss,
  removeWildwoodCard,
} from "@/lib/content-systems/wildwood/gauntlet";
export function prepareWildwoodBossInDraft(draft: RunTransaction, removeIndex?: number) {
  const state = draft.session.wildwoodDraft;
  const deck = draft.run.activeRun.runDeck;
  if (!state || !canPrepareNextWildwoodBoss(snapshotTransactionValue(state), deck.length)) return null;
  const nextDeck =
    removeIndex === undefined
      ? deck
      : removeWildwoodCard(snapshotTransactionValue(state), snapshotTransactionValue(deck), removeIndex);
  if (!nextDeck) return null;
  const prepared = prepareNextWildwoodBoss(
    snapshotTransactionValue(state),
    nextDeck.length,
    createDraftRunRandomSource(draft, "world"),
  );
  if (!prepared) return null;
  const battle = enterWildwoodBattle(prepared.state);
  if (!battle) return null;
  if (removeIndex !== undefined) setRunDeck(draft, nextDeck);
  setWildwoodDraft(draft, battle);
  return { bossId: prepared.bossId, modifierId: prepared.modifierId };
}
export function prepareWildwoodBoss(removeIndex: number | undefined, gameSession: GameSession) {
  return dispatchRunSessionCommand(
    (draft) => {
      const result = prepareWildwoodBossInDraft(draft, removeIndex);
      if (!result) return rejectCommand("Wildwood action is unavailable", null);
      const battleStarted = initializeBattle(draft, {
        kind: "boss-by-id",
        options: { bossId: result.bossId, wildwoodModifierId: result.modifierId },
      });
      return battleStarted
        ? acceptCommand({ ...result, battleStarted })
        : rejectCommand("Wildwood battle cannot start", null);
    },
    undefined,
    gameSession,
  );
}

export function chooseWildwoodDraftCard(cardId: string, gameSession: GameSession): void {
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
export function completeWildwoodDraft(gameSession: GameSession): boolean {
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
