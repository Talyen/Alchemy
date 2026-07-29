// Active-run domain store (activeRun + initialized + navigation).
// Composed views and adapters live in run-store-views.ts.
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { createInitialRunDomainData, type RunDomainDataState } from "./run-domain-types";
import { type ProgressActions, defineProgressActions } from "./slices/progress-slice";
import { type NavigationActions, defineNavigationActions } from "./slices/navigation-slice";
import { resetRunProfileStore } from "./run-profile-store";
import { resetRunTransientStore } from "./run-transient-store";
import { resetRunBattleDomainStore } from "./run-battle-domain-store";

export type RunDomainStore = RunDomainDataState & ProgressActions & NavigationActions;

export const useRunDomainStore = create<RunDomainStore>()(
  immer((set) => ({
    ...createInitialRunDomainData(),
    ...defineProgressActions(set),
    ...defineNavigationActions(set),
  })),
);

/** Imperative access to the active-run domain store API. */
export function getRunDomainStore(): RunDomainStore {
  return useRunDomainStore.getState();
}

/** Reset every run-domain lifetime store to initial values (tests and full teardown). */
export function resetRunDomainStore(): void {
  useRunDomainStore.setState(createInitialRunDomainData());
  resetRunProfileStore();
  resetRunTransientStore();
  resetRunBattleDomainStore();
}
