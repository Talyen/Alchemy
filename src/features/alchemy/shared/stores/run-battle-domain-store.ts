import { createInitialBattleFields, type RunDomainBattleState } from "./run-domain-types";
import type { BattleActions } from "./slices/battle-slice";
import { createSliceStore } from "./slice-store-adapter";
import type { GameplayState } from "./gameplay-state-store";

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

const battleActionKeys = new Set<string>([
  "setSyncedBattleState",
  "setDisplayOverrides",
  "clearDisplayOverrides",
  "setBattleStartState",
  "setHasActiveBattle",
  "initializeActiveBattle",
]);

function pickRunBattleDomainStore(state: GameplayState): RunBattleDomainStore {
  return { ...state.battle, ...state.battleActions };
}

function writeRunBattleDomainKey(state: GameplayState, key: keyof RunBattleDomainStore, value: unknown): void {
  if (battleActionKeys.has(String(key))) {
    (state.battleActions as unknown as Record<string, unknown>)[String(key)] = value;
    return;
  }
  (state.battle as unknown as Record<string, unknown>)[String(key)] = value;
}

export const useRunBattleDomainStore = createSliceStore<RunBattleDomainStore>(
  pickRunBattleDomainStore,
  BATTLE_KEYS,
  {},
  writeRunBattleDomainKey,
);

export function resetRunBattleDomainStore(): void {
  useRunBattleDomainStore.setState(createInitialBattleFields(), false);
}
