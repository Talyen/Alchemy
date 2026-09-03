import { create } from "zustand";
import { createInitialRunDomainData, createInitialSessionFields, createInitialBattleFields } from "./run-domain-types";
import { createInitialPermanentFields } from "./run-state-init";
import { createInitialProfileState } from "./profile-store-types";
import { createInitialGearState } from "./gear-store-initial-state";
import type { RunDomainDataState, RunDomainBattleState, RunSessionFields } from "./run-domain-types";
import type { PermanentProgressFields } from "./run-state-init";
import type { GearStateFields } from "./gear-store-types";
import type { ProfileStateFields } from "./profile-store-types";

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
  gear: createInitialGearState(),
}));

export function readGameplayState(): GameplayState {
  return useGameplayStateStore.getState();
}

export function subscribeGameplayCommits(listener: (revision: number) => void): () => void {
  return useGameplayStateStore.subscribe((state) => listener(state.revision));
}
