import { vi } from "vitest";
import { useGameplayStateStore } from "@/features/alchemy/shared/stores/gameplay-state-store";
import {
  dispatchRunSessionCommand,
  type SynchronousResult,
} from "@/features/alchemy/shared/stores/run-session-command";
import {
  createInitialBattleFields,
  createInitialRunDomainData,
  createInitialSessionFields,
  type RunSessionFields,
} from "@/features/alchemy/shared/stores/run-domain-types";
import {
  createInitialActiveRunFields,
  createInitialPermanentFields,
  type ActiveRunProgressFields,
  type PermanentProgressFields,
} from "@/features/alchemy/shared/stores/run-state-init";
import { dispatchGearMutationWithRunHealthSync } from "@/features/alchemy/shared/stores/gear-session-command";
import type { GearStore } from "@/features/alchemy/shared/stores/gear-store-types";
import { createInitialGearState } from "@/features/alchemy/shared/stores/gear-store-initial-state";
import { createInitialProfileState } from "@/features/alchemy/shared/stores/profile-store-types";
import {
  clearTransientSession,
  initializeActiveBattle,
  resetToDefaults,
  setScreen,
  setHasActiveRun,
  setRewardState,
  setCompanionRewardCards,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { resetTransientRunUi } from "@/features/alchemy/shared/stores/reset";
type RunStateFields = ActiveRunProgressFields & PermanentProgressFields & { initialized: boolean };

export function resetRunDomainStore(): void {
  const revision = useGameplayStateStore.getState().revision + 1;
  useGameplayStateStore.setState(
    {
      revision,
      run: createInitialRunDomainData(),
      session: createInitialSessionFields(),
      battle: createInitialBattleFields(),
      runProfile: createInitialPermanentFields(),
      profile: createInitialProfileState(),
      gear: createInitialGearState(),
    },
    true,
  );
}

export function resetRunProgressSlice(): void {
  dispatchRunSessionCommand((draft) => {
    draft.run.activeRun = createInitialActiveRunFields(null);
    draft.run.initialized = false;
    draft.runProfile = createInitialPermanentFields();
  });
}

export function resetRunSessionSlice(): void {
  dispatchRunSessionCommand((draft) => clearTransientSession(draft));
}

export function resetRunNavigationSlice(): void {
  dispatchRunSessionCommand((draft) => setScreen(draft, "menu"));
}

export function resetRunBattleSlice(): void {
  dispatchRunSessionCommand((draft) => initializeActiveBattle(draft, null));
}

export function resetProfileForTest(): void {
  dispatchRunSessionCommand((draft) => resetToDefaults(draft));
}

export function mutateGearForTest<T>(
  mutate: (gear: GearStore) => T & SynchronousResult<T>,
  syncRunHealth?: boolean,
): T {
  return dispatchGearMutationWithRunHealthSync<T>(syncRunHealth === undefined ? { mutate } : { mutate, syncRunHealth });
}

export function resetGearForTest(): void {
  mutateGearForTest((gear) => gear.reset());
}

export function resetAllTestStores(): void {
  vi.clearAllMocks();
  resetRunDomainStore();
  resetTransientRunUi();
}

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
  "rewardFlow",
  "activity",
  "activeLabyrinthModifiers",
  "activeLabyrinthRewardModifiers",
  "activeLabyrinthPendingNode",
  "selectedLabyrinthNodeId",
  "runEndLabyrinthFloor",
  "runEndMaterials",
  "runEndTalentXP",
  "runEndItems",
  "pendingCharacterId",
  "pendingContentSystemType",
  "labyrinthMap",
  "wildwoodDraft",
  "starterDraftChoices",
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

export function setRunSession(
  partial: Partial<RunSessionFields> & {
    hasActiveRun?: boolean;
    rewardState?: RunSessionFields["rewardFlow"]["state"];
    companionRewardCards?: RunSessionFields["rewardFlow"]["companionCards"];
    rewardClaimInFlight?: boolean;
    pendingDestinationClaim?: import("@/lib/routing").Destination | null;
  },
  replace = false,
): void {
  dispatchRunSessionCommand((draft) => {
    if (replace) Object.assign(draft.session, createInitialSessionFields());
    if (partial.hasActiveRun !== undefined) setHasActiveRun(draft, partial.hasActiveRun);
    if (partial.rewardState !== undefined) setRewardState(draft, partial.rewardState);
    if (partial.companionRewardCards !== undefined) setCompanionRewardCards(draft, partial.companionRewardCards);
    if (partial.rewardClaimInFlight !== undefined)
      draft.session.rewardFlow.claim = { kind: partial.rewardClaimInFlight ? "reward" : "idle" };
    if (partial.pendingDestinationClaim !== undefined)
      draft.session.rewardFlow.claim = partial.pendingDestinationClaim
        ? { kind: "destination", destination: partial.pendingDestinationClaim }
        : { kind: "idle" };
    for (const key of SESSION_KEYS) {
      if (key in partial && partial[key] !== undefined) {
        (draft.session as unknown as Record<string, unknown>)[key] = partial[key];
      }
    }
  });
}
