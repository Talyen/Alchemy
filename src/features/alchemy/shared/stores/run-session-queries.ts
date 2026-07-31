// Canonical imperative queries over the gameplay aggregate.
// React orchestration uses narrow facade ports; event-time handlers and
// persistence adapters use these same projections so there is one mapping from
// the aggregate to imperative state.
import {
  type ActiveRunProgressFields,
  type PermanentProgressFields,
} from "@/features/alchemy/shared/stores/run-state-init";
import type { Screen } from "@/features/alchemy/shared/types";
import { readGameplayState, type GameplayState } from "./gameplay-state-store";
import type { RunDomainStore } from "./run-domain-store";
import type { RunProfileActions, RunProfileStore } from "./run-profile-store";
import type { RunTransientStore } from "./run-transient-store";
import type { RunBattleDomainStore } from "./run-battle-domain-store";
import type { ProfileStore } from "./profile-store";
import type { GearStore } from "./gear-store-types";
import type { RunSessionFields, RunDomainBattleState } from "./run-domain-types";
import type { SessionActions } from "./slices/session-slice";
import type { BattleActions } from "./slices/battle-slice";

export interface RunSessionStoreSnapshot {
  domain: RunDomainStore;
  transient: RunTransientStore;
  battle: RunBattleDomainStore;
  runProfile: RunProfileStore;
  profile: ProfileStore;
  gear: GearStore;
}

// -------- Picker helpers (key arrays + generic picker) --------

const runProgressActionKeys = [
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
] as const satisfies ReadonlyArray<keyof RunDomainStore>;

const profileActionKeys = [
  "unlockTalent",
  "resetUnlockedTalents",
  "clearPermanentData",
  "applyTalentState",
  "addMaterials",
  "setMaterials",
  "constructBuilding",
  "plantFarm",
  "completeResearch",
  "bondCompanion",
] as const satisfies ReadonlyArray<keyof RunProfileActions>;

const sessionActionKeys = [
  "setHasActiveRun",
  "beginRewardClaim",
  "releaseRewardClaim",
  "beginDestinationClaim",
  "cancelDestinationClaim",
  "setActiveLabyrinthModifiers",
  "setActiveLabyrinthRewardModifiers",
  "setActiveLabyrinthPendingNode",
  "setRewardState",
  "setCompanionRewardCards",
  "setRunEndMaterials",
  "setRunEndTalentXP",
  "setCorruptionResult",
  "setPendingCharacterId",
  "setPendingContentSystemType",
  "setLabyrinthMap",
  "setWildwoodDraft",
  "setShopState",
  "setAlchemistState",
  "setTrinketShopState",
  "setEquipmentShopState",
  "setMysteryEvent",
  "setMysteryCardChoices",
  "clearTransientSession",
  "applyDestinationChoices",
] as const satisfies ReadonlyArray<keyof SessionActions>;

const navigationActionKeys = ["setScreen"] as const satisfies ReadonlyArray<keyof RunDomainStore>;

const battleActionKeys = [
  "setSyncedBattleState",
  "setDisplayOverrides",
  "clearDisplayOverrides",
  "setBattleStartState",
  "setHasActiveBattle",
  "initializeActiveBattle",
] as const satisfies ReadonlyArray<keyof BattleActions>;

function mapActions<State extends object, K extends keyof State>(state: State, keys: readonly K[]): Pick<State, K> {
  const result = {} as Pick<State, K>;
  for (const key of keys) {
    result[key] = state[key];
  }
  return result;
}

function pickActiveRunActions(state: RunDomainStore) {
  return { ...mapActions(state, runProgressActionKeys), reset: state.resetProgress };
}

function pickRunProfileActions(state: RunProfileStore) {
  return mapActions(state, profileActionKeys);
}

function pickSessionActions(state: RunTransientStore) {
  return mapActions(state, sessionActionKeys);
}

function pickNavigationActions(state: RunDomainStore) {
  return { ...mapActions(state, navigationActionKeys), reset: state.resetNavigation };
}

function pickBattleActions(state: RunBattleDomainStore) {
  return mapActions(state, battleActionKeys);
}

function projectRunDomain(state: GameplayState): RunDomainStore {
  return { ...state.run, ...state.runActions };
}

function projectRunProfile(state: GameplayState): RunProfileStore {
  return { ...state.runProfile, ...state.runProfileActions };
}

function projectTransient(state: GameplayState): RunTransientStore {
  return { ...state.session, ...state.sessionActions };
}

function projectBattle(state: GameplayState): RunBattleDomainStore {
  return { ...state.battle, ...state.battleActions };
}

function projectProfile(state: GameplayState): ProfileStore {
  return { ...state.profile, ...state.profileActions };
}

function projectGear(state: GameplayState): GearStore {
  return {
    ...state.gear,
    initialize: state.gearActions.gearInitialize,
    addInstance: state.gearActions.gearAddInstance,
    transferToInventory: state.gearActions.gearTransferToInventory,
    equip: state.gearActions.gearEquip,
    unequip: state.gearActions.gearUnequip,
    moveBoardItem: state.gearActions.gearMoveBoardItem,
    syncBoardPositions: state.gearActions.gearSyncBoardPositions,
    sortBoard: state.gearActions.gearSortBoard,
    salvage: state.gearActions.gearSalvage,
    applyCurrency: state.gearActions.gearApplyCurrency,
    addCurrencies: state.gearActions.gearAddCurrencies,
    reset: state.gearActions.gearReset,
  };
}

/** Project the committed aggregate once for callers that need multiple domains. */
export function createRunSessionStoreSnapshot(state: GameplayState = readGameplayState()): RunSessionStoreSnapshot {
  return {
    domain: projectRunDomain(state),
    transient: projectTransient(state),
    battle: projectBattle(state),
    runProfile: projectRunProfile(state),
    profile: projectProfile(state),
    gear: projectGear(state),
  };
}

// -------- View types derived from picker return types --------

export type ActiveRunStore = ActiveRunProgressFields &
  Pick<RunDomainStore, "initialized"> &
  ReturnType<typeof pickActiveRunActions>;
export type RunProfileStoreView = PermanentProgressFields & ReturnType<typeof pickRunProfileActions>;
export type RunSessionStore = RunSessionFields & ReturnType<typeof pickSessionActions>;
export type NavigationStore = { screen: Screen } & ReturnType<typeof pickNavigationActions>;

export function getActiveRunStoreView(state: GameplayState = readGameplayState()): ActiveRunStore {
  const domain = projectRunDomain(state);
  return { ...domain.activeRun, initialized: domain.initialized, ...pickActiveRunActions(domain) };
}

export function getRunProfileStoreView(state: GameplayState = readGameplayState()): RunProfileStoreView {
  const profile = projectRunProfile(state);
  return { ...profile, ...pickRunProfileActions(profile) };
}

export function getRunSessionStoreView(state: GameplayState = readGameplayState()): RunSessionStore {
  const session = projectTransient(state);
  return { ...session, ...pickSessionActions(session) };
}

export function getNavigationStoreView(state: GameplayState = readGameplayState()): NavigationStore {
  const domain = projectRunDomain(state);
  return { ...domain.navigation, ...pickNavigationActions(domain) };
}

export type BattleStoreView = RunDomainBattleState & ReturnType<typeof pickBattleActions>;

export function getBattleStoreView(state: GameplayState = readGameplayState()): BattleStoreView {
  const battle = projectBattle(state);
  return {
    battleState: battle.battleState,
    displayOverrides: battle.displayOverrides,
    battleStartState: battle.battleStartState,
    hasActiveBattle: battle.hasActiveBattle,
    ...pickBattleActions(battle),
  };
}
