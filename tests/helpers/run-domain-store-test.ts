import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { createInitialSessionFields, type RunSessionFields } from "@/features/alchemy/shared/stores/run-domain-types";
import {
  createInitialActiveRunFields,
  createInitialPermanentFields,
  type ActiveRunProgressFields,
  type PermanentProgressFields,
} from "@/features/alchemy/shared/stores/run-state-init";
import {
  resetAllTestStores,
  resetRunBattleSlice,
  resetRunDomainStore,
  resetRunNavigationSlice,
  resetRunProgressSlice,
  resetRunSessionSlice,
} from "./gameplay-store-test";

export {
  resetAllTestStores,
  resetRunBattleSlice,
  resetRunDomainStore,
  resetRunNavigationSlice,
  resetRunProgressSlice,
  resetRunSessionSlice,
};

type RunStateFields = ActiveRunProgressFields & PermanentProgressFields & { initialized: boolean };

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

const SESSION_KEYS = [
  "hasActiveRun",
  "rewardClaimInFlight",
  "pendingDestinationClaim",
  "activeLabyrinthModifiers",
  "activeLabyrinthRewardModifiers",
  "activeLabyrinthPendingNode",
  "selectedLabyrinthNodeId",
  "runEndLabyrinthFloor",
  "rewardState",
  "companionRewardCards",
  "runEndMaterials",
  "runEndTalentXP",
  "runEndItems",
  "corruptionResult",
  "pendingCharacterId",
  "pendingContentSystemType",
  "labyrinthMap",
  "wildwoodDraft",
  "starterDraftChoices",
  "shopState",
  "alchemistState",
  "trinketShopState",
  "equipmentShopState",
  "mysteryEvent",
  "mysteryChosenChoice",
  "mysteryPendingRemoval",
  "mysteryCardChoices",
  "mysteryGrantedTrinketIds",
  "mysteryGrantedGearInstances",
  "mysteryChosenCardId",
] as const satisfies ReadonlyArray<keyof RunSessionFields>;

type AssertKeysCover<T, K extends ReadonlyArray<keyof T>> = [keyof T] extends [K[number]] ? true : never;

const runProgressKeyGuards: Readonly<{
  activeRun: AssertKeysCover<ActiveRunProgressFields, typeof ACTIVE_RUN_PROGRESS_KEYS>;
  permanent: AssertKeysCover<PermanentProgressFields, typeof PERMANENT_PROGRESS_KEYS>;
  session: AssertKeysCover<RunSessionFields, typeof SESSION_KEYS>;
}> = { activeRun: true, permanent: true, session: true };
void runProgressKeyGuards;

export function setRunProgress(partial: Partial<RunStateFields>, replace = false): void {
  dispatchRunSessionCommand((draft) => {
    if (replace) {
      draft.run.activeRun = createInitialActiveRunFields(null);
      draft.run.initialized = false;
      draft.runProfile = createInitialPermanentFields();
    }
    for (const key of ACTIVE_RUN_PROGRESS_KEYS) {
      if (key in partial && partial[key] !== undefined) {
        (draft.run.activeRun as unknown as Record<string, unknown>)[key] = partial[key];
      }
    }
    for (const key of PERMANENT_PROGRESS_KEYS) {
      if (key in partial && partial[key] !== undefined) {
        (draft.runProfile as unknown as Record<string, unknown>)[key] = partial[key];
      }
    }
    if (partial.initialized !== undefined) draft.run.initialized = partial.initialized;
  });
}

export function setRunSession(partial: Partial<RunSessionFields>, replace = false): void {
  dispatchRunSessionCommand((draft) => {
    if (replace) Object.assign(draft.session, createInitialSessionFields());
    for (const key of SESSION_KEYS) {
      if (key in partial && partial[key] !== undefined) {
        (draft.session as unknown as Record<string, unknown>)[key] = partial[key];
      }
    }
  });
}
