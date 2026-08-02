// Active-run progression commands. Feature code must use these wrappers rather
// than receiving the aggregate's raw action functions through a read view.
import type { BattleCard, KeywordId } from "@/lib/game-data";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { RunRngStream } from "@/lib/run-rng";
import type { Screen } from "@/features/alchemy/shared/types";
import type { RunDomainStore } from "../run-domain-store";
import { dispatchRunSessionCommand } from "../run-session-command";
import { createRunSessionStoreSnapshot } from "../run-session-queries";

type RunValueUpdate<T> = T | ((previous: T) => T);
export type RunDeckUpdate = Parameters<RunDomainStore["setRunDeck"]>[0];
type RunGoldUpdate = Parameters<RunDomainStore["setRunGold"]>[0];
type RunHealthUpdate = Parameters<RunDomainStore["setRunPlayerHealth"]>[0];
export type RunTrinketsUpdate = Parameters<RunDomainStore["setRunTrinkets"]>[0];

export function setRunDeck(value: RunDeckUpdate): void {
  dispatchRunSessionCommand(() => createRunSessionStoreSnapshot().domain.setRunDeck(value));
}

export function setRunGold(value: RunGoldUpdate): void {
  dispatchRunSessionCommand(() => createRunSessionStoreSnapshot().domain.setRunGold(value));
}

export function addRunGold(amount: number): void {
  dispatchRunSessionCommand(() => createRunSessionStoreSnapshot().domain.addRunGold(amount));
}

export function setRunPlayerHealth(value: RunHealthUpdate): void {
  dispatchRunSessionCommand(() => createRunSessionStoreSnapshot().domain.setRunPlayerHealth(value));
}

export function setRunMaxHealth(value: RunValueUpdate<number>): void {
  dispatchRunSessionCommand(() => createRunSessionStoreSnapshot().domain.setRunMaxHealth(value));
}

export function setRoomsEncountered(value: RunValueUpdate<number>): void {
  dispatchRunSessionCommand(() => createRunSessionStoreSnapshot().domain.setRoomsEncountered(value));
}

export function setCurrentAct(value: RunValueUpdate<number>): void {
  dispatchRunSessionCommand(() => createRunSessionStoreSnapshot().domain.setCurrentAct(value));
}

export function setDestinationIndexInAct(value: RunValueUpdate<number>): void {
  dispatchRunSessionCommand(() => createRunSessionStoreSnapshot().domain.setDestinationIndexInAct(value));
}

export function setCompletedDestinations(
  value: RunValueUpdate<RunDomainStore["activeRun"]["completedDestinations"]>,
): void {
  dispatchRunSessionCommand(() => createRunSessionStoreSnapshot().domain.setCompletedDestinations(value));
}

export function setDestinationOfferState(value: Parameters<RunDomainStore["setDestinationOfferState"]>[0]): void {
  dispatchRunSessionCommand(() => createRunSessionStoreSnapshot().domain.setDestinationOfferState(value));
}

export function setRunTrinkets(value: RunTrinketsUpdate): void {
  dispatchRunSessionCommand(() => createRunSessionStoreSnapshot().domain.setRunTrinkets(value));
}

export function setEncounteredRunEnemyIds(value: RunValueUpdate<string[]>): void {
  dispatchRunSessionCommand(() => createRunSessionStoreSnapshot().domain.setEncounteredRunEnemyIds(value));
}

export function setScreen(screen: Screen): void {
  dispatchRunSessionCommand(() => createRunSessionStoreSnapshot().domain.setScreen(screen));
}

export function awardCardXP(card: BattleCard): void {
  dispatchRunSessionCommand(() => createRunSessionStoreSnapshot().domain.awardCardXP(card));
}

export function awardMysteryXP(keywordId: KeywordId, amount: number): void {
  dispatchRunSessionCommand(() => createRunSessionStoreSnapshot().domain.awardMysteryXP(keywordId, amount));
}

export function addRunMaterialsEarned(materials: MaterialInventory): void {
  dispatchRunSessionCommand(() => createRunSessionStoreSnapshot().domain.addRunMaterialsEarned(materials));
}

export function clearRunMaterialsEarned(): void {
  dispatchRunSessionCommand(() => createRunSessionStoreSnapshot().domain.clearRunMaterialsEarned());
}

/** Draw from a persisted run stream without exposing the aggregate action. */
export function createRunRandomSource(stream: RunRngStream): () => number {
  return () => dispatchRunSessionCommand(() => createRunSessionStoreSnapshot().domain.nextRunRandom(stream));
}
