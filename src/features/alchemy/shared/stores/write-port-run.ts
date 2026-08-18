import type { RunRngStream } from "@/lib/run-rng";
import { bindDraftAction, type GameplayDraft } from "./run-session-command";
import { createGameplayDraftRunActions, readGameplayState } from "./gameplay-state-store";
import { addProfileGold, setProfileGold } from "./gold-purse";

const runActions = (state: GameplayDraft) => createGameplayDraftRunActions(state);

export const setRunDeck = bindDraftAction((s) => runActions(s).setRunDeck);
export function setRunGold(draft: GameplayDraft, action: number | ((prev: number) => number)): void {
  setProfileGold(draft, action);
}
export function addRunGold(draft: GameplayDraft, amount: number): void {
  addProfileGold(draft, amount);
}
export const setRunPlayerHealth = bindDraftAction((s) => runActions(s).setRunPlayerHealth);
export const setRunMaxHealth = bindDraftAction((s) => runActions(s).setRunMaxHealth);
export const setRoomsEncountered = bindDraftAction((s) => runActions(s).setRoomsEncountered);
export const setCurrentAct = bindDraftAction((s) => runActions(s).setCurrentAct);
export const setDestinationIndexInAct = bindDraftAction((s) => runActions(s).setDestinationIndexInAct);
export const setCompletedDestinations = bindDraftAction((s) => runActions(s).setCompletedDestinations);
export const setContentSystemType = bindDraftAction((s) => runActions(s).setContentSystemType);
export const setDestinationOfferState = bindDraftAction((s) => runActions(s).setDestinationOfferState);
export const setRunTrinkets = bindDraftAction((s) => runActions(s).setRunTrinkets);
export const setEncounteredRunEnemyIds = bindDraftAction((s) => runActions(s).setEncounteredRunEnemyIds);
export const setScreen = bindDraftAction((s) => runActions(s).setScreen);
export const awardCardXP = bindDraftAction((s) => runActions(s).awardCardXP);
export const awardMysteryXP = bindDraftAction((s) => runActions(s).awardMysteryXP);
export const addRunMaterialsEarned = bindDraftAction((s) => runActions(s).addRunMaterialsEarned);
export const clearRunMaterialsEarned = bindDraftAction((s) => runActions(s).clearRunMaterialsEarned);

/** Draw from a persisted run stream without exposing the aggregate action. */
export function createRunRandomSource(stream: RunRngStream): () => number {
  return () => readGameplayState().runActions.nextRunRandom(stream);
}

export function createDraftRunRandomSource(draft: GameplayDraft, stream: RunRngStream): () => number {
  const nextRunRandom = runActions(draft).nextRunRandom;
  return () => nextRunRandom(stream);
}
