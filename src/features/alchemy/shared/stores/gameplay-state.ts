import { createStore } from "zustand/vanilla";
import { createInitialGearState } from "./gear-actions";
import type { GearStateFields } from "./gear-store-types";
import type { ProfileStateFields } from "./profile-store-types";
import { createInitialProfileState } from "./profile-store-types";
import type { RunDomainDataState, RunSessionFields } from "./run-domain-types";
import { createInitialRunDomainData, createInitialSessionFields } from "./run-domain-types";
import type { PermanentProgressFields } from "./run-state-init";
import { createInitialPermanentFields } from "./run-state-init";

export interface GameplayState {
  revision: number;
  run: RunDomainDataState;
  session: RunSessionFields;
  runProfile: PermanentProgressFields;
  profile: ProfileStateFields;
  gear: GearStateFields;
}

export function createGameplayStore(generateSeed: () => number) {
  return createStore<GameplayState>()(() => ({
    revision: 0,
    run: createInitialRunDomainData(generateSeed),
    session: createInitialSessionFields(),
    runProfile: createInitialPermanentFields(),
    profile: createInitialProfileState(),
    gear: createInitialGearState(),
  }));
}
