// Active-combat domain store — synced BattleState plus battle-scoped display overrides.
// Lifetime: one battle; cleared by clearBattleUi / teardownRun.
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { createInitialBattleFields, type RunDomainBattleState } from "./run-domain-types";
import { defineBattleActions, type BattleActions } from "./slices/battle-slice";

export type RunBattleDomainStore = RunDomainBattleState & BattleActions;

export const useRunBattleDomainStore = create<RunBattleDomainStore>()(
  immer((set) => ({
    ...createInitialBattleFields(),
    ...defineBattleActions(set),
  })),
);

/** Imperative access to the battle domain store API. */
export function getRunBattleDomainStore(): RunBattleDomainStore {
  return useRunBattleDomainStore.getState();
}

/** Reset combat state to a no-battle baseline (teardown and tests). */
export function resetRunBattleDomainStore(): void {
  useRunBattleDomainStore.setState(createInitialBattleFields());
}
