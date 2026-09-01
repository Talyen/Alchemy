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
import { EMPTY_CRAFTING_CURRENCIES } from "@/lib/gear/crafting";
import {
  clearTransientSession,
  initializeActiveBattle,
  resetToDefaults,
  setScreen,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { dispatchGearMutationWithRunHealthSync } from "@/features/alchemy/shared/stores/gear-session-command";
import type { GearStore } from "@/features/alchemy/shared/stores/gear-store-types";

function createInitialGearState() {
  return {
    inventories: createEmptyGearInventories(),
    loadouts: createEmptyGearLoadouts(),
    ownedTrinketIds: [] as string[],
    equippedTrinkets: createEmptyEquippedTrinkets(),
    craftingCurrencies: { ...EMPTY_CRAFTING_CURRENCIES },
  };
}

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

export function resetAllTestStores(): void {
  vi.clearAllMocks();
  resetRunDomainStore();
  resetTransientRunUi();
}
