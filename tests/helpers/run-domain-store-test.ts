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

export {
  getRunProgressStoreView,
  getRunSessionStoreView,
  getNavigationStoreView,
  getBattleStoreView,
  resetRunDomainStore,
};

export function resetRunProgressSlice() {
  useRunDomainStore.setState((s) => {
    s.progress = createInitialProgressFields();
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

export function setRunProgress(partial: Partial<ReturnType<typeof createInitialProgressFields>>, replace = false) {
  useRunDomainStore.setState((s) => {
    if (replace) s.progress = { ...createInitialProgressFields(), ...partial };
    else Object.assign(s.progress, partial);
  });
}

export function setRunSession(partial: Partial<ReturnType<typeof createInitialSessionFields>>, replace = false) {
  useRunDomainStore.setState((s) => {
    if (replace) s.session = { ...createInitialSessionFields(), ...partial };
    else Object.assign(s.session, partial);
  });
}
