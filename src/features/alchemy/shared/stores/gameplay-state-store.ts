// Authoritative gameplay aggregate.
//
// All persisted gameplay state lives in one Zustand root. Commands can mutate a
// private Immer draft and publish the root once, which keeps React readers and
// autosave on one revision while preserving explicit lifetime-specific reset
// operations.
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Draft } from "immer";
import type { CharacterId, DifficultyId, KeywordId, TalentXP, UnlockedTalents } from "@/lib/game-data";
import type { CollectionTab } from "@/features/alchemy/shared/types";
import type { ProfileSaveFields } from "./profile-store-types";
import { createDefaultProfileSaveFields } from "./profile-store-types";
import { createInitialRunDomainData, createInitialSessionFields, createInitialBattleFields } from "./run-domain-types";
import { createInitialPermanentFields, type PermanentProgressFields } from "./run-state-init";
import { defineProgressActions, type ProgressActions } from "./slices/progress-slice";
import { defineSessionActions, type SessionActions } from "./slices/session-slice";
import { defineBattleActions, type BattleActions } from "./slices/battle-slice";
import { defineNavigationActions, type NavigationActions } from "./slices/navigation-slice";
import { createHomesteadProfileActions, type HomesteadProfileActions } from "./slices/progress-homestead-actions";
import { defineFieldSetter } from "./slices/_field-setter";
import {
  computeRunEndTalentXPSnapshot,
  mergeRunTalentXPIntoPermanent,
  talentPool,
  tryUnlockTalent,
  xpThresholdForPoints,
} from "@/lib/game-data";
import type { GearStore } from "./gear-store-types";
import { initialState as initialGearState } from "./gear-store-initial-state";
import { createGearActions, type GearStateFields } from "./gear-actions";
import type { RunDomainDataState, RunDomainBattleState, RunSessionFields } from "./run-domain-types";

export interface ProfileStateFields extends ProfileSaveFields {
  collectionTab: CollectionTab;
  collectionPages: Record<CollectionTab, number>;
}

interface ProfileActions {
  setDiscoveredCardIds: ProfileStoreSet<string[]>;
  setEncounteredEnemyIds: ProfileStoreSet<string[]>;
  setDiscoveredTrinketIds: ProfileStoreSet<string[]>;
  setCompletedDifficulties: ProfileStoreSet<Record<CharacterId, DifficultyId[]>>;
  setFinishedRunCharacters: ProfileStoreSet<CharacterId[]>;
  setCollectionPage: (tab: CollectionTab, page: number) => void;
  handleCollectionTabChange: (tab: CollectionTab) => void;
  resetToDefaults: () => void;
}

type ProfileStoreSet<T> = (value: T | ((previous: T) => T)) => void;

/** Gear commands use an aggregate-only prefix to avoid colliding with the run's initialize command. */
interface GearAggregateActions {
  gearInitialize: GearStore["initialize"];
  gearAddInstance: GearStore["addInstance"];
  gearTransferToInventory: GearStore["transferToInventory"];
  gearEquip: GearStore["equip"];
  gearUnequip: GearStore["unequip"];
  gearMoveBoardItem: GearStore["moveBoardItem"];
  gearSyncBoardPositions: GearStore["syncBoardPositions"];
  gearSortBoard: GearStore["sortBoard"];
  gearSalvage: GearStore["salvage"];
  gearApplyCurrency: GearStore["applyCurrency"];
  gearAddCurrencies: GearStore["addCurrencies"];
  gearReset: GearStore["reset"];
}

/**
 * The committed gameplay aggregate is deliberately nested by lifetime/domain.
 * Action groups remain beside each region so commands can target the owning
 * lifetime without turning persisted or read state into a flat bag.
 */
export interface GameplayState {
  revision: number;
  run: RunDomainDataState;
  session: RunSessionFields;
  battle: RunDomainBattleState;
  runProfile: PermanentProgressFields;
  profile: ProfileStateFields;
  gear: GearStateFields;
  runActions: ProgressActions & NavigationActions;
  sessionActions: SessionActions;
  battleActions: BattleActions;
  runProfileActions: HomesteadProfileActions & TalentActions;
  profileActions: ProfileActions;
  gearActions: GearAggregateActions;
}

interface TalentActions {
  unlockTalent: (keywordId: KeywordId, talentId: string) => void;
  unlockAllTalents: () => void;
  resetUnlockedTalents: () => void;
  clearPermanentData: () => void;
  applyTalentState: (talentXP: TalentXP, unlockedTalents: UnlockedTalents) => void;
  mergeRunTalentXPIntoProfile: (runTalentXP: TalentXP, multiplier: number) => TalentXP;
}

type StateUpdate = GameplayState | Partial<GameplayState> | ((state: GameplayState) => unknown);

function readActiveGameplayState(): GameplayState {
  return useGameplayStateStore.getState();
}

type RootSet = (partial: StateUpdate) => void;

type NestedSet<State extends object> = (partial: State | Partial<State> | ((state: State) => unknown)) => void;

interface GameplayActionGroups {
  runActions: GameplayState["runActions"];
  sessionActions: GameplayState["sessionActions"];
  battleActions: GameplayState["battleActions"];
  runProfileActions: GameplayState["runProfileActions"];
  profileActions: GameplayState["profileActions"];
  gearActions: GameplayState["gearActions"];
}

function createNestedSet<T extends object>(rootSet: RootSet, select: (state: GameplayState) => T): NestedSet<T> {
  return (partial) => {
    rootSet((state) => {
      const slice = select(state);
      const next = typeof partial === "function" ? partial(slice) : partial;
      if (!next || typeof next !== "object" || next === slice) return;
      Object.assign(slice, next);
    });
  };
}

function createRunActionGroup(rootSet: RootSet): GameplayState["runActions"] {
  const setRun = createNestedSet(rootSet, (state) => state.run);
  return { ...defineProgressActions(setRun), ...defineNavigationActions(setRun) };
}

function createSessionActionGroup(rootSet: RootSet): GameplayState["sessionActions"] {
  return defineSessionActions(createNestedSet(rootSet, (state) => state.session));
}

function createBattleActionGroup(rootSet: RootSet): GameplayState["battleActions"] {
  return defineBattleActions(createNestedSet(rootSet, (state) => state.battle));
}

function createRunProfileActionGroup(rootSet: RootSet): GameplayState["runProfileActions"] {
  const setRunProfile = createNestedSet(rootSet, (state) => state.runProfile);
  return { ...createHomesteadProfileActions(setRunProfile), ...createTalentActions(setRunProfile) };
}

function createProfileActionGroup(rootSet: RootSet): GameplayState["profileActions"] {
  return createProfileActions(createNestedSet(rootSet, (state) => state.profile));
}

function createGearActionGroup(rootSet: RootSet, rootGet: () => GameplayState): GameplayState["gearActions"] {
  const gearActions = createGearActions(
    createNestedSet(rootSet, (state) => state.gear),
    () => rootGet().gear,
  );
  return {
    gearInitialize: gearActions.initialize,
    gearAddInstance: gearActions.addInstance,
    gearTransferToInventory: gearActions.transferToInventory,
    gearEquip: gearActions.equip,
    gearUnequip: gearActions.unequip,
    gearMoveBoardItem: gearActions.moveBoardItem,
    gearSyncBoardPositions: gearActions.syncBoardPositions,
    gearSortBoard: gearActions.sortBoard,
    gearSalvage: gearActions.salvage,
    gearApplyCurrency: gearActions.applyCurrency,
    gearAddCurrencies: gearActions.addCurrencies,
    gearReset: gearActions.reset,
  };
}

function createActionGroups(rootSet: RootSet, rootGet: () => GameplayState): GameplayActionGroups {
  return {
    runActions: createRunActionGroup(rootSet),
    sessionActions: createSessionActionGroup(rootSet),
    battleActions: createBattleActionGroup(rootSet),
    runProfileActions: createRunProfileActionGroup(rootSet),
    profileActions: createProfileActionGroup(rootSet),
    gearActions: createGearActionGroup(rootSet, rootGet),
  };
}

function createInitialProfileState(): ProfileStateFields {
  return {
    ...createDefaultProfileSaveFields(),
    collectionTab: "cards",
    collectionPages: { cards: 0, bestiary: 0, trinkets: 0 },
  };
}

function createTalentActions(set: (fn: (state: PermanentProgressFields) => void) => void): TalentActions {
  return {
    unlockTalent: (keywordId, talentId) =>
      set((state) => {
        const result = tryUnlockTalent(keywordId, talentId, state.talentXP, state.unlockedTalents);
        if (result.unlockedTalents) state.unlockedTalents = result.unlockedTalents;
      }),
    unlockAllTalents: import.meta.env.DEV
      ? () =>
          set((state) => {
            const next: UnlockedTalents = {};
            const xp: TalentXP = {};
            for (const talent of talentPool) {
              next[talent.keywordId] = [...(next[talent.keywordId] ?? []), talent.id];
            }
            for (const [keyword, ids] of Object.entries(next)) {
              xp[keyword as KeywordId] = xpThresholdForPoints(ids.length);
            }
            state.unlockedTalents = next;
            state.talentXP = xp;
          })
      : () => {},
    resetUnlockedTalents: () =>
      set((state) => {
        state.unlockedTalents = {};
      }),
    clearPermanentData: () =>
      set((state) => {
        Object.assign(state, createInitialPermanentFields());
      }),
    applyTalentState: (talentXP, unlockedTalents) =>
      set((state) => {
        state.talentXP = talentXP;
        state.unlockedTalents = unlockedTalents;
      }),
    mergeRunTalentXPIntoProfile: (runTalentXP, multiplier) => {
      const snapshot = computeRunEndTalentXPSnapshot(runTalentXP, multiplier);
      set((state) => {
        state.talentXP = mergeRunTalentXPIntoPermanent(runTalentXP, state.talentXP, multiplier);
      });
      return snapshot;
    },
  };
}

function createProfileActions(set: (fn: (state: ProfileStateFields) => void) => void): ProfileActions {
  const setField = defineFieldSetter(set);

  return {
    setDiscoveredCardIds: setField("discoveredCardIds"),
    setEncounteredEnemyIds: setField("encounteredEnemyIds"),
    setDiscoveredTrinketIds: setField("discoveredTrinketIds"),
    setCompletedDifficulties: setField("completedDifficulties"),
    setFinishedRunCharacters: setField("finishedRunCharacters"),
    setCollectionPage: (tab, page) =>
      set((state) => {
        state.collectionPages[tab] = Math.max(0, page);
      }),
    handleCollectionTabChange: (tab) =>
      set((state) => {
        state.collectionTab = tab;
        state.collectionPages[tab] ??= 0;
      }),
    resetToDefaults: () =>
      set((state) => {
        Object.assign(state, createInitialProfileState());
      }),
  };
}

export const useGameplayStateStore = create<GameplayState>()(
  immer((set, get) => {
    const commitRootUpdate: RootSet = (partial) => {
      set((state) => {
        if (typeof partial === "function") {
          const result = partial(state);
          if (result && result !== state) Object.assign(state, result);
        } else {
          Object.assign(state, partial);
        }
        state.revision += 1;
      });
    };
    const runDomain = createInitialRunDomainData();
    const session = createInitialSessionFields();
    const battle = createInitialBattleFields();
    const profile = createInitialPermanentFields();
    const collection = createInitialProfileState();
    const gear = initialGearState;
    const actions = createActionGroups(commitRootUpdate, get);

    return {
      revision: 0,
      run: runDomain,
      session,
      battle,
      runProfile: profile,
      profile: collection,
      gear,
      ...actions,
    };
  }),
);

export function readGameplayState(): GameplayState {
  return readActiveGameplayState();
}

/** Create action groups whose setters mutate the supplied Immer draft in place. */
export function createGameplayDraftActions(draft: Draft<GameplayState>): GameplayActionGroups {
  const draftSet = createDraftRootSet(draft);
  return createActionGroups(draftSet, () => draft);
}

function createDraftRootSet(draft: Draft<GameplayState>): RootSet {
  return (partial) => {
    if (typeof partial === "function") {
      const result = partial(draft);
      if (result && result !== draft) Object.assign(draft, result);
      return;
    }
    Object.assign(draft, partial);
  };
}

/** Create only the run action group for a draft command. */
export function createGameplayDraftRunActions(draft: Draft<GameplayState>): GameplayState["runActions"] {
  return createRunActionGroup(createDraftRootSet(draft));
}

/** Create only the transient-session action group for a draft command. */
export function createGameplayDraftSessionActions(draft: Draft<GameplayState>): GameplayState["sessionActions"] {
  return createSessionActionGroup(createDraftRootSet(draft));
}

/** Create only the battle action group for a draft command. */
export function createGameplayDraftBattleActions(draft: Draft<GameplayState>): GameplayState["battleActions"] {
  return createBattleActionGroup(createDraftRootSet(draft));
}

/** Create only the run-profile action group for a draft command. */
export function createGameplayDraftRunProfileActions(draft: Draft<GameplayState>): GameplayState["runProfileActions"] {
  return createRunProfileActionGroup(createDraftRootSet(draft));
}

/** Create only the profile action group for a draft command. */
export function createGameplayDraftProfileActions(draft: Draft<GameplayState>): GameplayState["profileActions"] {
  return createProfileActionGroup(createDraftRootSet(draft));
}

/** Create only the gear action group for a draft command. */
export function createGameplayDraftGearActions(draft: Draft<GameplayState>): GameplayState["gearActions"] {
  return createGearActionGroup(createDraftRootSet(draft), () => draft);
}

export function subscribeGameplayCommits(listener: (revision: number) => void): () => void {
  return useGameplayStateStore.subscribe((state) => listener(state.revision));
}
