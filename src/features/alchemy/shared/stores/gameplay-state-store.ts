// Authoritative gameplay aggregate.
//
// All persisted gameplay state lives in one Zustand root. Commands can mutate a
// private Immer draft and publish the root once, which keeps React readers and
// autosave on one revision while preserving the existing lifetime-specific
// reset operations exposed by the facade.
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { produce } from "immer";
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

export interface ProfileActions {
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

export type GameplayState = { revision: number } & RunDomainDataState &
  RunSessionFields &
  RunDomainBattleState &
  PermanentProgressFields &
  ProfileStateFields &
  GearStateFields &
  ProgressActions &
  SessionActions &
  BattleActions &
  NavigationActions &
  HomesteadProfileActions &
  TalentActions &
  ProfileActions &
  GearAggregateActions;

export interface TalentActions {
  unlockTalent: (keywordId: KeywordId, talentId: string) => void;
  unlockAllTalents: () => void;
  resetUnlockedTalents: () => void;
  clearPermanentData: () => void;
  applyTalentState: (talentXP: TalentXP, unlockedTalents: UnlockedTalents) => void;
  mergeRunTalentXPIntoProfile: (runTalentXP: TalentXP, multiplier: number) => TalentXP;
}

let transactionDepth = 0;
let transactionDraft: GameplayState | null = null;
type StateUpdate = GameplayState | Partial<GameplayState> | ((state: GameplayState) => unknown);
let rawSet: ((partial: StateUpdate, replace?: boolean) => void) | null = null;
let rawGet: (() => GameplayState) | null = null;
const gameplayCommitListeners = new Set<(revision: number) => void>();

function transactionAwareGet(): GameplayState {
  return transactionDraft ?? rawGet!();
}

type RootSet = (partial: StateUpdate, replace?: boolean) => void;

function transactionAwareSet(partial: Parameters<RootSet>[0], replace?: boolean): void {
  if (!transactionDraft) {
    rawSet!(partial, replace);
    return;
  }

  const current = transactionDraft;
  if (typeof partial === "function") {
    transactionDraft = produce(current, (draft: GameplayState) => {
      const result = partial(draft);
      if (result && result !== draft) Object.assign(draft, result);
    });
    return;
  }

  transactionDraft = produce(current, (draft: GameplayState) => {
    if (replace) {
      Object.assign(draft, partial);
      return;
    }
    Object.assign(draft, partial);
  });
}

function createInitialProfileState(): ProfileStateFields {
  return {
    ...createDefaultProfileSaveFields(),
    collectionTab: "cards",
    collectionPages: { cards: 0, bestiary: 0, trinkets: 0 },
  };
}

function createTalentActions(set: RootSet): TalentActions {
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

function createProfileActions(set: RootSet): ProfileActions {
  const update = <T>(key: keyof ProfileStateFields, value: T | ((previous: T) => T)) =>
    set((state) => {
      const previous = state[key] as T;
      (state[key] as T) = typeof value === "function" ? (value as (previous: T) => T)(previous) : value;
    });

  return {
    setDiscoveredCardIds: (value) => update("discoveredCardIds", value),
    setEncounteredEnemyIds: (value) => update("encounteredEnemyIds", value),
    setDiscoveredTrinketIds: (value) => update("discoveredTrinketIds", value),
    setCompletedDifficulties: (value) => update("completedDifficulties", value),
    setFinishedRunCharacters: (value) => update("finishedRunCharacters", value),
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
    rawGet = get;
    rawSet = (partial) => {
      if (typeof partial === "function") {
        set((state) => {
          const result = partial(state);
          if (result && result !== state) Object.assign(state, result);
          state.revision += 1;
        });
        for (const listener of gameplayCommitListeners) listener(get().revision);
        return;
      }
      set((state) => {
        Object.assign(state, partial);
        state.revision += 1;
      });
      for (const listener of gameplayCommitListeners) listener(get().revision);
    };
    const rootSet = transactionAwareSet;
    const rootGet = transactionAwareGet;
    const runDomain = createInitialRunDomainData();
    const session = createInitialSessionFields();
    const battle = createInitialBattleFields();
    const profile = createInitialPermanentFields();
    const collection = createInitialProfileState();
    const gear = initialGearState;
    const gearActions = createGearActions(rootSet, rootGet);

    return {
      revision: 0,
      ...runDomain,
      ...session,
      ...battle,
      ...profile,
      ...collection,
      ...gear,
      ...defineProgressActions(rootSet),
      ...defineSessionActions(rootSet),
      ...defineBattleActions(rootSet),
      ...defineNavigationActions(rootSet),
      ...createHomesteadProfileActions(rootSet),
      ...createTalentActions(rootSet),
      ...createProfileActions(rootSet),
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
  }),
);

export function readGameplayState(): GameplayState {
  return transactionAwareGet();
}

export function beginGameplayTransaction(): void {
  if (transactionDepth === 0) transactionDraft = useGameplayStateStore.getState();
  transactionDepth += 1;
}

export function commitGameplayTransaction(): void {
  transactionDepth -= 1;
  if (transactionDepth > 0) return;
  const next = transactionDraft;
  const previous = useGameplayStateStore.getState();
  transactionDraft = null;
  if (next && next !== previous) rawSet!(next, true);
}

export function rollbackGameplayTransaction(): void {
  transactionDepth = 0;
  transactionDraft = null;
}

export function applyGameplayStateUpdate(partial: StateUpdate, replace?: boolean): void {
  transactionAwareSet(partial, replace);
}

export function subscribeGameplayCommits(listener: (revision: number) => void): () => void {
  gameplayCommitListeners.add(listener);
  return () => gameplayCommitListeners.delete(listener);
}
