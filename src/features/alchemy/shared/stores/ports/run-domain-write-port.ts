// Active-run progression commands. Feature code must use these wrappers rather
// than receiving the aggregate's raw action functions through a read view.
import type { BattleCard, KeywordId } from "@/lib/game-data";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { RunRngStream } from "@/lib/run-rng";
import type { Screen } from "@/features/alchemy/shared/types";
import type { GameplayState } from "../gameplay-state-store";
import { dispatchRunSessionCommand } from "../run-session-command";
import { readGameplayState } from "../gameplay-state-store";

type RunValueUpdate<T> = T | ((previous: T) => T);
type RunActions = GameplayState["runActions"];
type RunGoldUpdate = Parameters<RunActions["setRunGold"]>[0];
type RunHealthUpdate = Parameters<RunActions["setRunPlayerHealth"]>[0];
export type RunTrinketsUpdate = Parameters<RunActions["setRunTrinkets"]>[0];
export type RunDeckUpdate = Parameters<RunActions["setRunDeck"]>[0];

export function setRunDeck(value: RunDeckUpdate): void {
  dispatchRunSessionCommand(() => readGameplayState().runActions.setRunDeck(value));
}

export function setRunGold(value: RunGoldUpdate): void {
  dispatchRunSessionCommand(() => readGameplayState().runActions.setRunGold(value));
}

export function addRunGold(amount: number): void {
  dispatchRunSessionCommand(() => readGameplayState().runActions.addRunGold(amount));
}

export function setRunPlayerHealth(value: RunHealthUpdate): void {
  dispatchRunSessionCommand(() => readGameplayState().runActions.setRunPlayerHealth(value));
}

export function setRunMaxHealth(value: RunValueUpdate<number>): void {
  dispatchRunSessionCommand(() => readGameplayState().runActions.setRunMaxHealth(value));
}

export function setRoomsEncountered(value: RunValueUpdate<number>): void {
  dispatchRunSessionCommand(() => readGameplayState().runActions.setRoomsEncountered(value));
}

export function setCurrentAct(value: RunValueUpdate<number>): void {
  dispatchRunSessionCommand(() => readGameplayState().runActions.setCurrentAct(value));
}

export function setDestinationIndexInAct(value: RunValueUpdate<number>): void {
  dispatchRunSessionCommand(() => readGameplayState().runActions.setDestinationIndexInAct(value));
}

export function setCompletedDestinations(
  value: RunValueUpdate<GameplayState["run"]["activeRun"]["completedDestinations"]>,
): void {
  dispatchRunSessionCommand(() => readGameplayState().runActions.setCompletedDestinations(value));
}

export function setDestinationOfferState(value: Parameters<RunActions["setDestinationOfferState"]>[0]): void {
  dispatchRunSessionCommand(() => readGameplayState().runActions.setDestinationOfferState(value));
}

export function setRunTrinkets(value: RunTrinketsUpdate): void {
  dispatchRunSessionCommand(() => readGameplayState().runActions.setRunTrinkets(value));
}

export function setEncounteredRunEnemyIds(value: RunValueUpdate<string[]>): void {
  dispatchRunSessionCommand(() => readGameplayState().runActions.setEncounteredRunEnemyIds(value));
}

export function setScreen(screen: Screen): void {
  dispatchRunSessionCommand(() => readGameplayState().runActions.setScreen(screen));
}

export function awardCardXP(card: BattleCard): void {
  dispatchRunSessionCommand(() => readGameplayState().runActions.awardCardXP(card));
}

export function awardMysteryXP(keywordId: KeywordId, amount: number): void {
  dispatchRunSessionCommand(() => readGameplayState().runActions.awardMysteryXP(keywordId, amount));
}

export function addRunMaterialsEarned(materials: MaterialInventory): void {
  dispatchRunSessionCommand(() => readGameplayState().runActions.addRunMaterialsEarned(materials));
}

export function clearRunMaterialsEarned(): void {
  dispatchRunSessionCommand(() => readGameplayState().runActions.clearRunMaterialsEarned());
}

/** Draw from a persisted run stream without exposing the aggregate action. */
export function createRunRandomSource(stream: RunRngStream): () => number {
  return () => dispatchRunSessionCommand(() => readGameplayState().runActions.nextRunRandom(stream));
}
