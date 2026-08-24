// Authoritative gameplay aggregate.
//
// All persisted gameplay state lives in one Zustand root. Commands open an
// explicit Immer produce over the committed root (dispatchRunSessionCommand)
// and publish it once, which keeps React readers and autosave on one revision
// while preserving explicit lifetime-specific reset operations. The aggregate
// holds data only; every mutation is a draft-first mutator in the write-port
// modules committed via dispatchRunSessionCommand().
import { create } from "zustand";
import { createInitialRunDomainData, createInitialSessionFields, createInitialBattleFields } from "./run-domain-types";
import { createInitialPermanentFields } from "./run-state-init";
import { createInitialProfileState } from "./profile-store-types";
import { initialState as initialGearState } from "./gear-store-initial-state";
import type { RunDomainDataState, RunDomainBattleState, RunSessionFields } from "./run-domain-types";
import type { PermanentProgressFields } from "./run-state-init";
import type { GearStateFields } from "./gear-store-types";
import type { ProfileStateFields } from "./profile-store-types";

/**
 * The committed gameplay aggregate is deliberately nested by lifetime/domain
 * so commands target exactly one region's draft when mutating.
 */
export interface GameplayState {
  revision: number;
  run: RunDomainDataState;
  session: RunSessionFields;
  battle: RunDomainBattleState;
  runProfile: PermanentProgressFields;
  profile: ProfileStateFields;
  gear: GearStateFields;
}

export const useGameplayStateStore = create<GameplayState>()(() => ({
  revision: 0,
  run: createInitialRunDomainData(),
  session: createInitialSessionFields(),
  battle: createInitialBattleFields(),
  runProfile: createInitialPermanentFields(),
  profile: createInitialProfileState(),
  gear: initialGearState,
}));

export function readGameplayState(): GameplayState {
  return useGameplayStateStore.getState();
}

export function subscribeGameplayCommits(listener: (revision: number) => void): () => void {
  return useGameplayStateStore.subscribe((state) => listener(state.revision));
}
