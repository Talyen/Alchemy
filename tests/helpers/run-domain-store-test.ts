// Test helpers for the run-lifetime stores — slice reads/writes without legacy shims.
import {
  useRunDomainStore,
  getRunProgressStoreView,
  getRunSessionStoreView,
  getNavigationStoreView,
  getBattleStoreView,
  resetRunDomainStore,
} from "@/features/alchemy/shared/stores/run-domain-store";
import { useRunProfileStore } from "@/features/alchemy/shared/stores/run-profile-store";
import { useRunTransientStore } from "@/features/alchemy/shared/stores/run-transient-store";
import { useRunBattleDomainStore } from "@/features/alchemy/shared/stores/run-battle-domain-store";
import {
  createInitialSessionFields,
  createInitialBattleFields,
} from "@/features/alchemy/shared/stores/run-domain-types";
import {
  applyActiveRunProgressPartial,
  applyPermanentProgressPartial,
  createInitialActiveRunFields,
  createInitialPermanentFields,
  type RunStateFields,
} from "@/features/alchemy/shared/stores/run-state-init";

export {
  getRunProgressStoreView,
  getRunSessionStoreView,
  getNavigationStoreView,
  getBattleStoreView,
  resetRunDomainStore,
};

export function resetRunProgressSlice() {
  useRunDomainStore.setState((s) => {
    s.activeRun = createInitialActiveRunFields(null);
    s.initialized = false;
  });
  useRunProfileStore.setState(createInitialPermanentFields());
}

export function resetRunSessionSlice() {
  useRunTransientStore.setState(createInitialSessionFields());
}

export function resetRunNavigationSlice() {
  useRunDomainStore.setState((s) => {
    s.navigation.screen = "menu";
  });
}

export function resetRunBattleSlice() {
  useRunBattleDomainStore.setState(createInitialBattleFields());
}

/** Apply flat progress fields (facade shape) onto the run-domain and profile stores. */
export function setRunProgress(partial: Partial<RunStateFields>, replace = false) {
  if (replace) {
    resetRunProgressSlice();
  }
  useRunDomainStore.setState((s) => {
    applyActiveRunProgressPartial(s, partial);
  });
  useRunProfileStore.setState((profile) => {
    applyPermanentProgressPartial(profile, partial);
  });
}

export function setRunSession(partial: Partial<ReturnType<typeof createInitialSessionFields>>, replace = false) {
  if (replace) {
    useRunTransientStore.setState({ ...createInitialSessionFields(), ...partial });
    return;
  }
  useRunTransientStore.setState(partial);
}
