import { appendCardToRunWithDiscovery } from "@/features/alchemy/shared/stores/deck-mutations";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import {
  createDraftRunRandomSource,
  prepareRunNavigation,
  setPendingCharacterId,
  setRunDeck,
  setWildwoodDraft,
} from "@/features/alchemy/shared/stores/run-session-write-port";
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
export function prepareWildwoodBoss(removeIndex?: number) {
  return dispatchRunSessionCommand((draft) => {
    const state = draft.session.wildwoodDraft;
    const deck = draft.run.activeRun.runDeck;
    if (!state || !canPrepareNextWildwoodBoss(state, deck.length)) return null;
    const nextDeck = removeIndex === undefined ? deck : removeWildwoodCard(state, deck, removeIndex);
    if (!nextDeck) return null;
    const prepared = prepareNextWildwoodBoss(state, deck.length, createDraftRunRandomSource(draft, "world"));
    if (!prepared) return null;
    const battle = enterWildwoodBattle(prepared.state);
    if (!battle) return null;
    if (removeIndex !== undefined) setRunDeck(draft, nextDeck);
    setWildwoodDraft(draft, battle);
    prepareRunNavigation(draft, ROUTE_SCREENS.BATTLE);
    return { bossId: prepared.bossId, modifierId: prepared.modifierId };
  });
}
export function chooseWildwoodDraftCard(cardId: string): void {
  dispatchRunSessionCommand((draft) => {
    const state = draft.session.wildwoodDraft;
    const activeRun = draft.run.activeRun;
    if (activeRun.contentSystemType !== CONTENT_SYSTEMS.WILDWOOD || !state) return;
    if (!offeredWildwoodDraftCard(state, activeRun.runDeck, cardId)) return;
    const pick = pickWildwoodDraftCard(
      state,
      activeRun.characterId,
      activeRun.runDeck,
      cardId,
      createDraftRunRandomSource(draft, "world"),
    );
    if (!pick) return;
    appendCardToRunWithDiscovery(draft, pick.card);
    setWildwoodDraft(draft, pick.state);
  });
}
export function completeWildwoodDraft(): boolean {
  return dispatchRunSessionCommand((draft) => {
    const state = draft.session.wildwoodDraft;
    const runDeck = draft.run.activeRun.runDeck;
    if (!state || !canCompleteWildwoodDraft(state, runDeck.length)) return false;
    setPendingCharacterId(draft, null);
    return true;
  });
}
export function prepareWildwoodRemoval(): void {
  dispatchRunSessionCommand((draft) => {
    const current = draft.session.wildwoodDraft;
    if (!current) return;
    const next = enterWildwoodRemoval(current);
    if (next) setWildwoodDraft(draft, next);
  });
}
