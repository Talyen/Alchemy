import {
  readGameplayState,
  useGameplayStateStore,
  type GameplayState,
} from "@/features/alchemy/shared/stores/gameplay-state-store";
import {
  createInitialBattleFields,
  createInitialRunDomainData,
  createInitialSessionFields,
  type RunDomainBattleState,
  type RunSessionFields,
} from "@/features/alchemy/shared/stores/run-domain-types";
import {
  createInitialActiveRunFields,
  createInitialPermanentFields,
} from "@/features/alchemy/shared/stores/run-state-init";

type RunDomainStore = GameplayState["run"] & GameplayState["runActions"];
type RunProfileStore = GameplayState["runProfile"] & GameplayState["runProfileActions"];
type RunTransientStore = RunSessionFields & GameplayState["sessionActions"];
type RunBattleDomainStore = RunDomainBattleState & GameplayState["battleActions"];
type ActiveRunStore = GameplayState["run"]["activeRun"] &
  Pick<GameplayState["run"], "initialized"> &
  GameplayState["runActions"] & { reset: GameplayState["runActions"]["resetProgress"] };
type NavigationStore = GameplayState["run"]["navigation"] &
  Pick<GameplayState["runActions"], "setScreen"> & { reset: GameplayState["runActions"]["resetNavigation"] };

interface StoreFacade<S> {
  <T>(selector?: (state: S) => T): T;
  getState: () => S;
  getInitialState: () => S;
  setState: (partial: Partial<S> | S | ((state: S) => unknown), replace?: boolean) => void;
}

/** Test-only aggregate mutation seam; production commands publish directly through Zustand. */
export function applyGameplayStateUpdate(partial: (state: GameplayState) => void): void {
  useGameplayStateStore.setState((state) => {
    partial(state);
    state.revision += 1;
  });
}

function runDomainView(state: GameplayState): RunDomainStore {
  return { ...state.run, ...state.runActions };
}

function runProfileView(state: GameplayState): RunProfileStore {
  return { ...state.runProfile, ...state.runProfileActions };
}

function runSessionView(state: GameplayState): RunTransientStore {
  return { ...state.session, ...state.sessionActions };
}

function runBattleView(state: GameplayState): RunBattleDomainStore {
  return { ...state.battle, ...state.battleActions };
}

function navigationView(state: GameplayState): NavigationStore {
  return { ...state.run.navigation, setScreen: state.runActions.setScreen, reset: state.runActions.resetNavigation };
}

function cloneView<S extends object>(view: S): S {
  return { ...view };
}

function createFacade<S extends object>(
  select: (state: GameplayState) => S,
  write: (state: GameplayState, next: S, previous: S, replace: boolean) => void,
): StoreFacade<S> {
  const facade = ((selector?: (state: S) => unknown) => {
    const view = select(useGameplayStateStore.getState());
    return selector ? selector(view) : view;
  }) as StoreFacade<S>;

  facade.getState = () => select(readGameplayState());
  facade.getInitialState = () => select(useGameplayStateStore.getInitialState());
  facade.setState = (partial, replace = false) => {
    applyGameplayStateUpdate((state) => {
      const previous = select(state);
      const draft = cloneView(previous);
      const result = typeof partial === "function" ? partial(draft) : partial;
      const next = result && typeof result === "object" && result !== draft ? { ...draft, ...result } : draft;
      write(state, next as S, previous, replace);
    });
  };
  return facade;
}

export const useRunDomainStore = createFacade(runDomainView, (state, next) => {
  state.run = { ...state.run, activeRun: next.activeRun, initialized: next.initialized, navigation: next.navigation };
});

export const useRunProfileStore = createFacade(runProfileView, (state, next) => {
  state.runProfile = { ...state.runProfile, ...next };
});

export const useRunTransientStore = createFacade(runSessionView, (state, next) => {
  state.session = { ...state.session, ...next };
});

export const useRunBattleDomainStore = createFacade(runBattleView, (state, next) => {
  state.battle = { ...state.battle, ...next };
});

export function getRunDomainStore(): RunDomainStore {
  return useRunDomainStore.getState();
}

export function getRunProfileStore(): RunProfileStore {
  return useRunProfileStore.getState();
}

export function getRunTransientStore(): RunTransientStore {
  return useRunTransientStore.getState();
}

function getRunBattleDomainStore(): RunBattleDomainStore {
  return useRunBattleDomainStore.getState();
}

export function getNavigationStoreView(): NavigationStore {
  return navigationView(readGameplayState());
}

export function getActiveRunStoreView(): ActiveRunStore {
  const state = readGameplayState();
  return {
    ...state.run.activeRun,
    initialized: state.run.initialized,
    ...state.runActions,
    reset: state.runActions.resetProgress,
  };
}

export function getRunProfileStoreView(): RunProfileStore {
  return getRunProfileStore();
}

export function getRunSessionStoreView(): RunTransientStore {
  return getRunTransientStore();
}

export function getBattleStoreView(): RunBattleDomainStore {
  return getRunBattleDomainStore();
}

export function resetRunDomainStore(): void {
  applyGameplayStateUpdate((state) => {
    state.run = createInitialRunDomainData();
    state.runProfile = createInitialPermanentFields();
    state.session = createInitialSessionFields();
    state.battle = createInitialBattleFields();
  });
}

export function resetRunProgressSlice(): void {
  applyGameplayStateUpdate((state) => {
    state.run.activeRun = createInitialActiveRunFields(null);
    state.run.initialized = false;
    state.runProfile = createInitialPermanentFields();
  });
}

export function resetRunSessionSlice(): void {
  useRunTransientStore.setState(createInitialSessionFields(), true);
}

export function resetRunNavigationSlice(): void {
  applyGameplayStateUpdate((state) => {
    state.run.navigation.screen = "menu";
  });
}

export function resetRunBattleSlice(): void {
  useRunBattleDomainStore.setState(createInitialBattleFields(), true);
}

// ---------------------------------------------------------------------------
// Profile & gear test facades
// ---------------------------------------------------------------------------
// These were removed from the production store modules (they were never imported
// by src/ — only by tests, for setup/reset and full-view reads). Kept as a thin
// convenience here so tests can still reset and inspect those two domains.

type TestProfileStore = GameplayState["profile"] & GameplayState["profileActions"];

function profileStoreView(state: GameplayState): TestProfileStore {
  return { ...state.profile, ...state.profileActions };
}

function gearStoreActions(state: GameplayState) {
  return {
    initialize: state.gearActions.gearInitialize,
    addInstance: state.gearActions.gearAddInstance,
    equip: state.gearActions.gearEquip,
    unequip: state.gearActions.gearUnequip,
    salvage: state.gearActions.gearSalvage,
    applyCurrency: state.gearActions.gearApplyCurrency,
    addCurrencies: state.gearActions.gearAddCurrencies,
    reset: state.gearActions.gearReset,
  };
}

type TestGearStore = GameplayState["gear"] & ReturnType<typeof gearStoreActions>;

function gearStoreView(state: GameplayState): TestGearStore {
  return { ...state.gear, ...gearStoreActions(state) };
}

export const useProfileStore = createFacade<TestProfileStore>(profileStoreView, (state, next) => {
  state.profile.discoveredCardIds = next.discoveredCardIds;
  state.profile.encounteredEnemyIds = next.encounteredEnemyIds;
  state.profile.discoveredTrinketIds = next.discoveredTrinketIds;
  state.profile.completedDifficulties = next.completedDifficulties;
  state.profile.finishedRunCharacters = next.finishedRunCharacters;
  state.profile.collectionTab = next.collectionTab;
  state.profile.collectionPages = next.collectionPages;
});

export const useGearStore = createFacade<TestGearStore>(gearStoreView, (state, next) => {
  state.gear.inventories = next.inventories;
  state.gear.loadouts = next.loadouts;
  state.gear.craftingCurrencies = next.craftingCurrencies;
});
