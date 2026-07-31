import { createInitialBattleFields, type RunDomainBattleState } from "./run-domain-types";
import type { BattleActions } from "./slices/battle-slice";
import { createSliceStore } from "./slice-store-adapter";

export type RunBattleDomainStore = RunDomainBattleState & BattleActions;

const BATTLE_KEYS = [
  "battleState",
  "displayOverrides",
  "battleStartState",
  "hasActiveBattle",
  "setSyncedBattleState",
  "setDisplayOverrides",
  "clearDisplayOverrides",
  "setBattleStartState",
  "setHasActiveBattle",
  "initializeActiveBattle",
] as const satisfies ReadonlyArray<keyof RunBattleDomainStore>;

export const useRunBattleDomainStore = createSliceStore<RunBattleDomainStore>((state) => state, BATTLE_KEYS);

export function getRunBattleDomainStore(): RunBattleDomainStore {
  return useRunBattleDomainStore.getState();
}

export function resetRunBattleDomainStore(): void {
  useRunBattleDomainStore.setState(createInitialBattleFields(), false);
}
