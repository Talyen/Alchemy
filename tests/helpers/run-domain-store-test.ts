// Test helpers for run-lifetime reads/writes against the authoritative aggregate.
import { createInitialSessionFields, type RunSessionFields } from "@/features/alchemy/shared/stores/run-domain-types";
import type { ActiveRunProgressFields, PermanentProgressFields } from "@/features/alchemy/shared/stores/run-state-init";
import {
  getActiveRunStoreView,
  getBattleStoreView,
  getNavigationStoreView,
  getRunProfileStoreView,
  getRunSessionStoreView,
  applyGameplayStateUpdate,
  resetAllTestStores,
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
  resetAllTestStores,
  resetRunBattleSlice,
  resetRunDomainStore,
  resetRunNavigationSlice,
  resetRunProgressSlice,
  resetRunSessionSlice,
};

export function getRunProgressStoreView() {
  const active = getActiveRunStoreView();
  const profile = getRunProfileStoreView();
  return { ...active, ...profile, runGold: profile.gold };
}

type RunStateFields = ActiveRunProgressFields & PermanentProgressFields & { initialized: boolean; runGold?: number };

const ACTIVE_RUN_PROGRESS_KEYS = [
  "characterId",
  "runDeck",
  "runPlayerHealth",
  "runMaxHealth",
  "runMetaMaxHealth",
  "roomsEncountered",
  "currentAct",
  "destinationIndexInAct",
  "completedDestinations",
  "lastOfferedDestinations",
  "destinationRoundsSinceOffered",
  "runBoons",
  "encounteredRunEnemyIds",
  "selectedDifficulty",
  "contentSystemType",
  "rng",
  "runTalentXP",
  "runMaterialsEarned",
  "runObtainedItems",
] as const satisfies ReadonlyArray<keyof ActiveRunProgressFields>;

const PERMANENT_PROGRESS_KEYS = [
  "gold",
  "talentXP",
  "unlockedTalents",
  "materialInventory",
  "constructedBuildings",
  "plantedFarms",
  "completedResearch",
  "bondedCompanions",
  "effects",
] as const satisfies ReadonlyArray<keyof PermanentProgressFields>;

// Compile-time guards: these lists must cover every field of their source type, so
// adding a field to ActiveRunProgressFields/PermanentProgressFields without listing
// it here becomes a type error instead of silently weakening setRunProgress(). The
// record asserts each list is exhaustive: a missing key resolves the field to
// `never`, so assigning `true` stops compiling. Referenced via void so noUnusedLocals
// stays quiet without an unused export that knip would flag.
type AssertKeysCover<T, K extends ReadonlyArray<keyof T>> = [keyof T] extends [K[number]] ? true : never;

const runProgressKeyGuards: Readonly<{
  activeRun: AssertKeysCover<ActiveRunProgressFields, typeof ACTIVE_RUN_PROGRESS_KEYS>;
  permanent: AssertKeysCover<PermanentProgressFields, typeof PERMANENT_PROGRESS_KEYS>;
}> = { activeRun: true, permanent: true };
void runProgressKeyGuards;

export function setRunProgress(partial: Partial<RunStateFields>, replace = false): void {
  if (replace) resetRunProgressSlice();
  applyGameplayStateUpdate((state) => {
    for (const key of ACTIVE_RUN_PROGRESS_KEYS) {
      if (key in partial && partial[key] !== undefined) {
        (state.run.activeRun as unknown as Record<string, unknown>)[key] = partial[key];
      }
    }
    if (partial.runGold !== undefined) {
      state.runProfile.gold = partial.runGold;
    }
    for (const key of PERMANENT_PROGRESS_KEYS) {
      if (key in partial && partial[key] !== undefined) {
        (state.runProfile as unknown as Record<string, unknown>)[key] = partial[key];
      }
    }
    if (partial.initialized !== undefined) state.run.initialized = partial.initialized;
  });
}

export function setRunSession(partial: Partial<RunSessionFields>, replace = false): void {
  if (replace) {
    useRunTransientStore.setState({ ...createInitialSessionFields(), ...partial }, true);
    return;
  }
  useRunTransientStore.setState(partial);
}
