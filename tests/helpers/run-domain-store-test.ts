import { vi } from "vitest";
import { useGameplayStateStore } from "@/features/alchemy/shared/stores/gameplay-state-store";
import {
  acceptCommand,
  dispatchGameplayCommand,
  type SynchronousResult,
} from "@/features/alchemy/shared/stores/gameplay-command";
import {
  createInitialRunDomainData,
  createInitialSessionFields,
  type RunSessionFields,
} from "@/features/alchemy/shared/stores/run-domain-types";
import {
  createInitialActiveRunFields,
  createInitialPermanentFields,
  setTestRunSeedOverride,
  ACTIVE_RUN_PROGRESS_KEYS,
  type ActiveRunProgressFields,
  type PermanentProgressFields,
} from "@/features/alchemy/shared/stores/run-state-init";
import { dispatchGearMutationWithRunHealthSync } from "@/features/alchemy/shared/stores/gear-session-command";
import type { GearDraftView } from "@/features/alchemy/shared/stores/gear-store-types";
import { createInitialGearState } from "@/features/alchemy/shared/stores/gear-actions";
import { createInitialProfileState } from "@/features/alchemy/shared/stores/profile-store-types";
import {
  clearTransientSession,
  resetToDefaults,
  setScreen,
  setHasActiveRun,
  setRewardState,
  setCompanionRewardCards,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { defaultBattleState, battleSnapshot, type BattleSnapshot } from "@/lib/battle";
import type { RunTransaction } from "@/features/alchemy/shared/stores/run-session-command";
import { transactionDraft } from "@/features/alchemy/shared/stores/transaction-internal";

import { resetTransientRunUi } from "@/features/alchemy/shared/stores/reset";

/** Fixtures establish a complete activity; production callers use validated lifecycle commands. */
export function initializeBattleForTest(transaction: RunTransaction, snapshot: BattleSnapshot | null): void {
  const draft = transactionDraft(transaction);
  if (snapshot) {
    const state = battleSnapshot(snapshot);
    draft.session.activity = { kind: "battle", data: { battleState: state, battleStartState: state } };
  } else if (draft.session.activity.kind === "battle") draft.session.activity = { kind: "idle" };
}

export function setBattleActiveForTest(transaction: RunTransaction, active: boolean): void {
  const draft = transactionDraft(transaction);
  if (active && draft.session.activity.kind !== "battle") initializeBattleForTest(transaction, defaultBattleState());
  else if (!active) initializeBattleForTest(transaction, null);
}

export function getBattleForTest(transaction: RunTransaction) {
  setBattleActiveForTest(transaction, true);
  const draft = transactionDraft(transaction);
  if (draft.session.activity.kind !== "battle") throw new Error("Missing fixture battle");
  return draft.session.activity.data;
}

export function replaceBattleForTest(transaction: RunTransaction, snapshot: BattleSnapshot): void {
  getBattleForTest(transaction).battleState = battleSnapshot(snapshot);
}
type RunStateFields = ActiveRunProgressFields & PermanentProgressFields & { initialized: boolean };

export function resetRunDomainStore(): void {
  const revision = useGameplayStateStore.getState().revision + 1;
  useGameplayStateStore.setState(
    {
      revision,
      run: createInitialRunDomainData(),
      session: createInitialSessionFields(),
      runProfile: createInitialPermanentFields(),
      profile: createInitialProfileState(),
      gear: createInitialGearState(),
    },
    true,
  );
}

export function resetRunProgressSlice(): void {
  dispatchGameplayCommand((draft) => {
    draft.run.activeRun = createInitialActiveRunFields(null);
    draft.run.initialized = false;
    draft.runProfile = createInitialPermanentFields();

    return acceptCommand();
  });
}

export function resetRunSessionSlice(): void {
  dispatchGameplayCommand((draft) => acceptCommand(clearTransientSession(draft)));
}

export function resetRunNavigationSlice(): void {
  dispatchGameplayCommand((draft) => acceptCommand(setScreen(draft, "menu")));
}

export function resetRunBattleSlice(): void {
  dispatchGameplayCommand((draft) => acceptCommand(initializeBattleForTest(draft, null)));
}

export function resetProfileForTest(): void {
  dispatchGameplayCommand((draft) => acceptCommand(resetToDefaults(draft)));
}

export function mutateGearForTest<T>(mutate: (gear: GearDraftView) => T & SynchronousResult<T>): T {
  return dispatchGearMutationWithRunHealthSync<T>({ mutate });
}

export function resetGearForTest(): void {
  mutateGearForTest((gear) => gear.reset());
}

export function resetAllTestStores(): void {
  vi.clearAllMocks();
  // The run-seed override is module-global: clear it so a seed set in one
  // test file cannot leak into another.
  setTestRunSeedOverride(null);
  resetRunDomainStore();
  resetTransientRunUi();
}

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
  "runEndCurrencies",
  "runEndTalentXP",
  "runEndItems",
  "runRecap",
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
  dispatchGameplayCommand((draft) => {
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

    return acceptCommand();
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
  dispatchGameplayCommand((draft) => {
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

    return acceptCommand();
  });
}
