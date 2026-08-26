// Test facades over the gameplay aggregate (`useRunTransientStore`, `useActiveRunStore`, etc.).
// These names are not production APIs; production code uses capability ports on gameplay-state-store.
// Action members dispatch real gameplay commands through the production write-port mutators.
import { vi } from "vitest";
import { produce } from "immer";
import type { Draft } from "immer";
import {
  readGameplayState,
  useGameplayStateStore,
  type GameplayState,
} from "@/features/alchemy/shared/stores/gameplay-state-store";
import { dispatchRunSessionCommand, type GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import { resetTransientRunUi } from "@/features/alchemy/shared/stores/reset";
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
import * as runPort from "@/features/alchemy/shared/stores/write-port-run";
import * as sessionPort from "@/features/alchemy/shared/stores/write-port-session";
import * as battlePort from "@/features/alchemy/shared/stores/write-port-battle";
import * as profilePort from "@/features/alchemy/shared/stores/write-port-profile";
import * as gearMutators from "@/features/alchemy/shared/stores/gear-actions";

/** Wrap a draft-first mutator as a self-contained command for test setup. */
function command<A extends unknown[], R>(mutate: (draft: GameplayDraft, ...args: A) => R): (...args: A) => R {
  return (...args) => dispatchRunSessionCommand((draft) => mutate(draft, ...args));
}

/** Parameter list of `F` without its leading draft-region argument. */
type Tail<F extends (...args: never[]) => unknown> = F extends (_: never, ...rest: infer R) => unknown ? R : never;

/** Test-only aggregate mutation seam; production commands publish directly through Zustand. */
export function applyGameplayStateUpdate(partial: (state: GameplayState) => void): void {
  useGameplayStateStore.setState((state) =>
    produce(state, (draft) => {
      partial(draft);
      draft.revision += 1;
    }),
  );
}

const runCommands = {
  setRunDeck: command(runPort.setRunDeck),
  setRunPlayerHealth: command(runPort.setRunPlayerHealth),
  setRunMaxHealth: command(runPort.setRunMaxHealth),
  setRoomsEncountered: command(runPort.setRoomsEncountered),
  setCurrentAct: command(runPort.setCurrentAct),
  setDestinationIndexInAct: command(runPort.setDestinationIndexInAct),
  setCompletedDestinations: command(runPort.setCompletedDestinations),
  setDestinationOfferState: command(runPort.setDestinationOfferState),
  setRunBoons: command(runPort.setRunBoons),
  setEncounteredRunEnemyIds: command(runPort.setEncounteredRunEnemyIds),
  setContentSystemType: command(runPort.setContentSystemType),
  resetProgress: command(runPort.resetProgress),
  nextRunRandom: command(runPort.nextRunRandom),
  resetRunXP: command(runPort.resetRunXP),
  awardCardXP: command(runPort.awardCardXP),
  awardMysteryXP: command(runPort.awardMysteryXP),
  addRunMaterialsEarned: command(runPort.addRunMaterialsEarned),
  clearRunMaterialsEarned: command(runPort.clearRunMaterialsEarned),
  recordRunObtainedItem: command(runPort.recordRunObtainedItem),
  initialize: command(
    (
      draft: GameplayDraft,
      activeRun: Parameters<typeof runPort.initializeActiveRun>[1],
      fallbackCharacterId?: Parameters<typeof runPort.initializeActiveRun>[2],
    ) => runPort.initializeActiveRun(draft, activeRun, fallbackCharacterId),
  ),
  initializeFromResumeSnapshot: command(runPort.initializeFromResumeSnapshot),
  hydrateFromSnapshot: command(runPort.hydrateFromSnapshot),
  setScreen: command(runPort.setScreen),
  resetNavigation: command(runPort.resetNavigation),
};

const sessionCommands = {
  setHasActiveRun: command(sessionPort.setHasActiveRun),
  beginRewardClaim: command(sessionPort.beginRewardClaim),
  releaseRewardClaim: command(sessionPort.releaseRewardClaim),
  beginDestinationClaim: command(sessionPort.beginDestinationClaim),
  cancelDestinationClaim: command(sessionPort.cancelDestinationClaim),
  setActiveLabyrinthModifiers: command(sessionPort.setActiveLabyrinthModifiers),
  setActiveLabyrinthRewardModifiers: command(sessionPort.setActiveLabyrinthRewardModifiers),
  setActiveLabyrinthPendingNode: command(sessionPort.setActiveLabyrinthPendingNode),
  setRewardState: command(sessionPort.setRewardState),
  setCompanionRewardCards: command(sessionPort.setCompanionRewardCards),
  setRunEndMaterials: command(sessionPort.setRunEndMaterials),
  setRunEndItems: command(sessionPort.setRunEndItems),
  setCorruptionResult: command(sessionPort.setCorruptionResult),
  setPendingCharacterId: command(sessionPort.setPendingCharacterId),
  setPendingContentSystemType: command(sessionPort.setPendingContentSystemType),
  setLabyrinthMap: command(sessionPort.setLabyrinthMap),
  setWildwoodDraft: command(sessionPort.setWildwoodDraft),
  setStarterDraftChoices: command(sessionPort.setStarterDraftChoices),
  setShopState: command(sessionPort.setShopState),
  setAlchemistState: command(sessionPort.setAlchemistState),
  setTrinketShopState: command(sessionPort.setTrinketShopState),
  setEquipmentShopState: command(sessionPort.setEquipmentShopState),
  setMysteryEvent: command(sessionPort.setMysteryEvent),
  setMysteryChosenChoice: command(sessionPort.setMysteryChosenChoice),
  setMysteryPendingRemoval: command(sessionPort.setMysteryPendingRemoval),
  setMysteryCardChoices: command(sessionPort.setMysteryCardChoices),
  setMysteryGrantedTrinketIds: command(sessionPort.setMysteryGrantedTrinketIds),
  setMysteryGrantedGearInstances: command(sessionPort.setMysteryGrantedGearInstances),
  setMysteryChosenCardId: command(sessionPort.setMysteryChosenCardId),
  clearTransientSession: command(sessionPort.clearTransientSession),
};

const battleCommands = {
  setSyncedBattleState: command(battlePort.setSyncedBattleState),
  setPendingBattleTransition: command(battlePort.setPendingBattleTransition),
  clearPendingTransitionResumeRequired: command(battlePort.clearPendingTransitionResumeRequired),
  setDisplayOverrides: command(battlePort.setDisplayOverrides),
  clearDisplayOverrides: command(battlePort.clearDisplayOverrides),
  setBattleStartState: command(battlePort.setBattleStartState),
  setHasActiveBattle: command(battlePort.setHasActiveBattle),
  initializeActiveBattle: command(battlePort.initializeActiveBattle),
};

const runProfileCommands = {
  addMaterials: command(profilePort.addMaterials),
  setMaterials: command(profilePort.setMaterials),
  constructBuilding: command(profilePort.constructBuilding),
  plantFarm: command(profilePort.plantFarm),
  completeResearch: command(profilePort.completeResearch),
  bondCompanion: command(profilePort.bondCompanion),
  unlockTalent: command(profilePort.unlockTalent),
  unlockAllTalents: command(profilePort.unlockAllTalents),
  resetUnlockedTalents: command(profilePort.resetUnlockedTalents),
  clearPermanentData: command(profilePort.clearPermanentData),
  applyTalentState: command(profilePort.applyTalentState),
  mergeRunTalentXPIntoProfile: command(profilePort.mergeRunTalentXPIntoProfile),
};

const profileCommands = {
  setDiscoveredCardIds: command(profilePort.setDiscoveredCardIds),
  setEncounteredEnemyIds: command(profilePort.setEncounteredEnemyIds),
  setDiscoveredTrinketIds: command(profilePort.setDiscoveredTrinketIds),
  setCompletedDifficulties: command(profilePort.setCompletedDifficulties),
  setFinishedRunCharacters: command(profilePort.setFinishedRunCharacters),
  setCollectionPage: command(profilePort.setCollectionPage),
  handleCollectionTabChange: command(profilePort.handleCollectionTabChange),
  resetToDefaults: command(profilePort.resetToDefaults),
};

const gearCommands = {
  initialize: command((draft: GameplayDraft, ...args: Tail<typeof gearMutators.initializeGear>) =>
    gearMutators.initializeGear(draft.gear, ...args),
  ),
  addInstance: command((draft: GameplayDraft, ...args: Tail<typeof gearMutators.addGearInstance>) =>
    gearMutators.addGearInstance(draft.gear, ...args),
  ),
  equip: command((draft: GameplayDraft, ...args: Tail<typeof gearMutators.equipGearInstance>) =>
    gearMutators.equipGearInstance(draft.gear, ...args),
  ),
  unequip: command((draft: GameplayDraft, ...args: Tail<typeof gearMutators.unequipGearInstance>) =>
    gearMutators.unequipGearInstance(draft.gear, ...args),
  ),
  addTrinket: command((draft: GameplayDraft, ...args: Tail<typeof gearMutators.addPermanentTrinket>) =>
    gearMutators.addPermanentTrinket(draft.gear, ...args),
  ),
  equipTrinket: command((draft: GameplayDraft, ...args: Tail<typeof gearMutators.equipPermanentTrinket>) =>
    gearMutators.equipPermanentTrinket(draft.gear, ...args),
  ),
  unequipTrinket: command((draft: GameplayDraft, ...args: Tail<typeof gearMutators.unequipPermanentTrinket>) =>
    gearMutators.unequipPermanentTrinket(draft.gear, ...args),
  ),
  salvage: command((draft: GameplayDraft, ...args: Tail<typeof gearMutators.salvageGearInstance>) =>
    gearMutators.salvageGearInstance(draft.gear, ...args),
  ),
  applyCurrency: command((draft: GameplayDraft, ...args: Tail<typeof gearMutators.applyGearCurrency>) =>
    gearMutators.applyGearCurrency(draft.gear, ...args),
  ),
  addCurrencies: command((draft: GameplayDraft, ...args: Tail<typeof gearMutators.addGearCurrencies>) =>
    gearMutators.addGearCurrencies(draft.gear, ...args),
  ),
  reset: command((draft: GameplayDraft) => gearMutators.resetGear(draft.gear)),
};

type RunDomainStore = GameplayState["run"] & typeof runCommands;
type RunProfileStore = GameplayState["runProfile"] & typeof runProfileCommands;
type RunTransientStore = RunSessionFields & typeof sessionCommands;
type RunBattleDomainStore = RunDomainBattleState & typeof battleCommands;
type ActiveRunStore = GameplayState["run"]["activeRun"] &
  Pick<GameplayState["run"], "initialized"> &
  typeof runCommands & { reset: typeof runCommands.resetProgress };
type NavigationStore = GameplayState["run"]["navigation"] &
  Pick<typeof runCommands, "setScreen" | "resetNavigation"> & { reset: typeof runCommands.resetNavigation };
type TestProfileStore = GameplayState["profile"] & typeof profileCommands;
type TestGearStore = GameplayState["gear"] & typeof gearCommands;

interface StoreFacade<S> {
  <T>(selector?: (state: S) => T): T;
  getState: () => S;
  getInitialState: () => S;
  setState: (partial: Partial<S> | S | ((state: S) => unknown), replace?: boolean) => void;
}

function runDomainView(state: GameplayState): RunDomainStore {
  return { ...state.run, ...runCommands };
}

function runProfileView(state: GameplayState): RunProfileStore {
  return { ...state.runProfile, ...runProfileCommands };
}

function runSessionView(state: GameplayState): RunTransientStore {
  return { ...state.session, ...sessionCommands };
}

function runBattleView(state: GameplayState): RunBattleDomainStore {
  return { ...state.battle, ...battleCommands };
}

function navigationView(state: GameplayState): NavigationStore {
  return {
    ...state.run.navigation,
    setScreen: runCommands.setScreen,
    resetNavigation: runCommands.resetNavigation,
    reset: runCommands.resetNavigation,
  };
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

const useRunDomainStore = createFacade(runDomainView, (state, next) => {
  state.run = {
    ...state.run,
    activeRun: next.activeRun,
    initialized: next.initialized,
    navigation: next.navigation,
    parkedRuns: next.parkedRuns,
    runRecency: next.runRecency,
  };
});

export const useRunProfileStore = createFacade(runProfileView, (state: Draft<GameplayState>, next) => {
  state.runProfile = { ...state.runProfile, ...next };
});

export const useRunTransientStore = createFacade(runSessionView, (state: Draft<GameplayState>, next) => {
  state.session = { ...state.session, ...next };
});

export const useRunBattleDomainStore = createFacade(runBattleView, (state: Draft<GameplayState>, next) => {
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
    ...runCommands,
    reset: runCommands.resetProgress,
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

/**
 * One-line beforeEach reset for store-heavy suites: clears mock recordings and
 * restores every gameplay slice (run, profile, session, battle, navigation)
 * plus transient UI state to their initial values.
 */
export function resetAllTestStores(): void {
  vi.clearAllMocks();
  resetRunDomainStore();
  resetTransientRunUi();
}

// ---------------------------------------------------------------------------
// Profile & gear test facades
// ---------------------------------------------------------------------------
// These were removed from the production store modules (they were never imported
// by src/ — only by tests, for setup/reset and full-view reads). Kept as a thin
// convenience here so tests can still reset and inspect those two domains.

function profileStoreView(state: GameplayState): TestProfileStore {
  return { ...state.profile, ...profileCommands };
}

function gearStoreView(state: GameplayState): TestGearStore {
  return { ...state.gear, ...gearCommands };
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
