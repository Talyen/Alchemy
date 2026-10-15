import { createNotificationChannel } from "./notification-channel";
import { deepFreeze } from "./store-utils";
import { logError } from "@/lib/error-logger";
import { createInitialGearState } from "./gear-state-defaults";
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

export function createGameplayStore(generateSeed: () => number, isActive: () => boolean = () => true) {
  const initial: GameplayState = deepFreeze({
    revision: 0,
    run: createInitialRunDomainData(generateSeed),
    session: createInitialSessionFields(),
    runProfile: createInitialPermanentFields(),
    profile: createInitialProfileState(),
    gear: createInitialGearState(),
  });
  let state = initial;
  type Listener = (state: GameplayState, previous: GameplayState) => void;
  const notifications = createNotificationChannel<Parameters<Listener>>((error) => {
    logError("Gameplay commit subscriber failed", "other", { revision: state.revision }, undefined, undefined, error);
  }, isActive);
  const reads = {
    getState: () => state,
    getInitialState: () => initial,
    subscribe: notifications.subscribe,
  };
  return {
    reads,
    // Install the root before publishing the save gate. Both observer channels
    // must read the same committed revision, with the presentation gate armed.
    commit(next: GameplayState, prepareObservers: () => void) {
      const previous = state;
      // Every exposed revision is immutable before either observer channel runs,
      // including the fresh state and the root rebuilt after Immer finishes.
      state = deepFreeze(next);
      prepareObservers();
      notifications.publish(state, previous);
    },
  };
}
