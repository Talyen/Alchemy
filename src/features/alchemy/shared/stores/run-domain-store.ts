import { createInitialRunDomainData, type RunDomainDataState } from "./run-domain-types";
import type { ProgressActions } from "./slices/progress-action-types";
import type { NavigationActions } from "./slices/navigation-slice";
import { createSliceStore } from "./slice-store-adapter";
import { resetRunProfileStore } from "./run-profile-store";
import { resetRunTransientStore } from "./run-transient-store";
import { resetRunBattleDomainStore } from "./run-battle-domain-store";

export type RunDomainStore = RunDomainDataState & ProgressActions & NavigationActions;

const RUN_DOMAIN_KEYS = [
  "activeRun",
  "initialized",
  "navigation",
  "setRunDeck",
  "setRunGold",
  "setRunPlayerHealth",
  "setRunMaxHealth",
  "setRoomsEncountered",
  "setCurrentAct",
  "setDestinationIndexInAct",
  "setCompletedDestinations",
  "setLastOfferedDestinations",
  "setDestinationRoundsSinceOffered",
  "setDestinationOfferState",
  "setRunTrinkets",
  "setEncounteredRunEnemyIds",
  "setSelectedDifficulty",
  "setContentSystemType",
  "setCharacter",
  "addRunGold",
  "nextRunRandom",
  "resetRunXP",
  "awardCardXP",
  "awardMysteryXP",
  "addRunMaterialsEarned",
  "clearRunMaterialsEarned",
  "initialize",
  "initializeFromResumeSnapshot",
  "hydrateFromSnapshot",
  "setScreen",
  "resetProgress",
  "resetNavigation",
] as const satisfies ReadonlyArray<keyof RunDomainStore>;

export const useRunDomainStore = createSliceStore<RunDomainStore>((state) => state, RUN_DOMAIN_KEYS);

export function getRunDomainStore(): RunDomainStore {
  return useRunDomainStore.getState();
}

export function resetRunDomainStore(): void {
  useRunDomainStore.setState(createInitialRunDomainData(), false);
  resetRunProfileStore();
  resetRunTransientStore();
  resetRunBattleDomainStore();
}
