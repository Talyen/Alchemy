// Test helpers for run-lifetime reads/writes against the authoritative aggregate.
import { applyGameplayStateUpdate } from "@/features/alchemy/shared/stores/gameplay-state-store";
import { createInitialSessionFields, type RunSessionFields } from "@/features/alchemy/shared/stores/run-domain-types";
import {
  applyActiveRunProgressPartial,
  applyPermanentProgressPartial,
  type RunStateFields,
} from "@/features/alchemy/shared/stores/run-state-init";
import {
  getActiveRunStoreView,
  getBattleStoreView,
  getNavigationStoreView,
  getRunProfileStoreView,
  getRunSessionStoreView,
  resetRunBattleSlice,
  resetRunDomainStore,
  resetRunNavigationSlice,
  resetRunProgressSlice,
  resetRunSessionSlice,
  useRunTransientStore,
} from "./gameplay-store-test";

export {
  getBattleStoreView,
  getNavigationStoreView,
  getRunSessionStoreView,
  resetRunBattleSlice,
  resetRunDomainStore,
  resetRunNavigationSlice,
  resetRunProgressSlice,
  resetRunSessionSlice,
};

export function getRunProgressStoreView() {
  return { ...getActiveRunStoreView(), ...getRunProfileStoreView() };
}

export function setRunProgress(partial: Partial<RunStateFields>, replace = false): void {
  if (replace) resetRunProgressSlice();
  applyGameplayStateUpdate((state) => {
    applyActiveRunProgressPartial(state.run, partial);
    applyPermanentProgressPartial(state.runProfile, partial);
  });
}

export function setRunSession(partial: Partial<RunSessionFields>, replace = false): void {
  if (replace) {
    useRunTransientStore.setState({ ...createInitialSessionFields(), ...partial }, true);
    return;
  }
  useRunTransientStore.setState(partial);
}
