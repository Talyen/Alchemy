// Test reset and gear/profile setup over the gameplay aggregate.
// Reads go through production ports; mutations go through dispatchRunSessionCommand.
import { vi } from "vitest";
import { useGameplayStateStore } from "@/features/alchemy/shared/stores/gameplay-state-store";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { resetTransientRunUi } from "@/features/alchemy/shared/stores/reset";
import {
  createInitialBattleFields,
  createInitialRunDomainData,
  createInitialSessionFields,
} from "@/features/alchemy/shared/stores/run-domain-types";
import {
  createInitialActiveRunFields,
  createInitialPermanentFields,
} from "@/features/alchemy/shared/stores/run-state-init";
import { createInitialProfileState } from "@/features/alchemy/shared/stores/profile-store-types";
import { createEmptyEquippedTrinkets, createEmptyGearInventories, createEmptyGearLoadouts } from "@/lib/gear/types";
import {
  clearTransientSession,
  initializeActiveBattle,
  resetToDefaults,
  setScreen,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { dispatchGearMutationWithRunHealthSync } from "@/features/alchemy/shared/stores/gear-session-command";
import type { GearStore } from "@/features/alchemy/shared/stores/gear-store-types";

const EMPTY_CRAFTING_CURRENCIES = {
  "discordant-dice": 0,
  "sprig-of-growth": 0,
  voidstone: 0,
  "ascension-seal": 0,
  "severance-maw": 0,
  "smiths-whetstone": 0,
};

function createInitialGearState() {
  return {
    inventories: createEmptyGearInventories(),
    loadouts: createEmptyGearLoadouts(),
    ownedTrinketIds: [] as string[],
    equippedTrinkets: createEmptyEquippedTrinkets(),
    craftingCurrencies: { ...EMPTY_CRAFTING_CURRENCIES },
  };
}

/** Replace the aggregate with fresh production initials so tests never share the Zustand template. */
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

export function mutateGearForTest<T>(mutate: (gear: GearStore) => T, syncRunHealth?: boolean): T {
  return dispatchGearMutationWithRunHealthSync(syncRunHealth === undefined ? { mutate } : { mutate, syncRunHealth });
}

export function resetGearForTest(): void {
  mutateGearForTest((gear) => gear.reset());
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
