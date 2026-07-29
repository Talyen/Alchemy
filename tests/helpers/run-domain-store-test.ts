// Test helpers for run domain store — slice reads/writes without legacy shims.
import {
  useRunDomainStore,
  getRunProgressStoreView,
  getRunSessionStoreView,
  getNavigationStoreView,
  getBattleStoreView,
  resetRunDomainStore,
} from "@/features/alchemy/shared/stores/run-domain-store";
import {
  createInitialProgressFields,
  createInitialSessionFields,
  createInitialBattleFields,
} from "@/features/alchemy/shared/stores/run-domain-types";
import {
  applyFlatRunDomainProgressPartial,
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
    const progress = createInitialProgressFields();
    s.activeRun = progress.run;
    s.profile = progress.permanent;
    s.initialized = progress.initialized;
  });
}

export function resetRunSessionSlice() {
  useRunDomainStore.setState((s) => {
    s.session = createInitialSessionFields();
  });
}

export function resetRunNavigationSlice() {
  useRunDomainStore.setState((s) => {
    s.navigation.screen = "menu";
  });
}

export function resetRunBattleSlice() {
  useRunDomainStore.setState((s) => {
    s.battle = createInitialBattleFields();
  });
}

/** Apply flat progress fields (facade shape) onto the nested progress slice. */
export function setRunProgress(partial: Partial<RunStateFields>, replace = false) {
  useRunDomainStore.setState((s) => {
    if (replace) {
      const progress = createInitialProgressFields();
      s.activeRun = progress.run;
      s.profile = progress.permanent;
      s.initialized = progress.initialized;
    }
    applyFlatRunDomainProgressPartial(s, partial);
  });
}

export function setRunSession(partial: Partial<ReturnType<typeof createInitialSessionFields>>, replace = false) {
  useRunDomainStore.setState((s) => {
    if (replace) s.session = { ...createInitialSessionFields(), ...partial };
    else Object.assign(s.session, partial);
  });
}
