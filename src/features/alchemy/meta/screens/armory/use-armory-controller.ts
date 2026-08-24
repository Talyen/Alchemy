import { useCallback, useMemo } from "react";
import type { CharacterId } from "@/lib/game-data";
import {
  generateDevRandomGearInstance,
  type CraftingCurrencyId,
  type GearInventories,
  type GearInstance,
  type GearLoadouts,
  type GearSlot,
  type SalvageYield,
} from "@/lib/gear";
import {
  resolveActiveRunForSave,
  flushSaveAfterGearMutation,
} from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import {
  dispatchGearMutationWithRunHealthSync,
  dispatchGearSalvageWithMaterialGrant,
} from "@/features/alchemy/shared/stores/gear-session-command";
import { useHasActiveRun } from "@/features/alchemy/shared/stores/run-session-react-ports";
import { useFinishedRunCharacters } from "@/features/alchemy/shared/stores/profile-store";
import { useGearArmorySlice } from "@/features/alchemy/shared/stores/gear-store";
import { useAppScreenChrome } from "@/app/app-screen-chrome-context";
import type { GearStore } from "@/features/alchemy/shared/stores/gear-store-types";
import { isAlchemyDevBuild } from "@/features/alchemy/shared/utils";

function mutateGearWithFlush<T>(
  flush: () => void,
  mutate: (state: GearStore) => T,
  options?: { flushOnSuccessOnly?: boolean },
): T {
  const result = dispatchGearMutationWithRunHealthSync({ mutate });
  if (options?.flushOnSuccessOnly ? result : true) flush();
  return result;
}

export interface ArmoryController {
  inventories: GearInventories;
  loadouts: GearLoadouts;
  craftingCurrencies: Record<CraftingCurrencyId, number>;
  finishedRunCharacters: CharacterId[];
  browseOnly: boolean;
  hasActiveRun: boolean;
  onEquip: (characterId: CharacterId, slot: GearSlot, instance: GearInstance) => void;
  onUnequip: (characterId: CharacterId, slot: GearSlot) => void;
  onSalvage: (instanceId: string, salvageYield: SalvageYield) => boolean;
  onApplyCurrency: (currencyId: CraftingCurrencyId, instanceId: string) => boolean;
  onSpawnDevGear?: (characterId: CharacterId) => void;
  rng: () => number;
}

export function useArmoryController(): ArmoryController {
  const { returnToRunScreen } = useAppScreenChrome();
  const gear = useGearArmorySlice();
  const finishedRunCharacters = useFinishedRunCharacters();
  const hasActiveRun = useHasActiveRun();

  const flush = useCallback(() => {
    flushSaveAfterGearMutation(resolveActiveRunForSave(hasActiveRun, returnToRunScreen ?? undefined));
  }, [hasActiveRun, returnToRunScreen]);

  const onEquip = useCallback<ArmoryController["onEquip"]>(
    (characterId, slot, instance) => {
      mutateGearWithFlush(flush, (state) => {
        state.equip(characterId, slot, instance);
      });
    },
    [flush],
  );

  const onUnequip = useCallback<ArmoryController["onUnequip"]>(
    (characterId, slot) => {
      mutateGearWithFlush(flush, (state) => {
        state.unequip(characterId, slot);
      });
    },
    [flush],
  );

  const onSalvage = useCallback<ArmoryController["onSalvage"]>(
    (instanceId, salvageYield) => {
      const result = dispatchGearSalvageWithMaterialGrant((state) =>
        state.salvage(instanceId, { yield: salvageYield }),
      );
      if (result) flush();
      return Boolean(result);
    },
    [flush],
  );

  const onApplyCurrency = useCallback<ArmoryController["onApplyCurrency"]>(
    (currencyId, instanceId) =>
      mutateGearWithFlush(flush, (state) => state.applyCurrency(currencyId, instanceId, { rng: Math.random }), {
        flushOnSuccessOnly: true,
      }),
    [flush],
  );

  const onSpawnDevGear = useCallback<NonNullable<ArmoryController["onSpawnDevGear"]>>(
    (characterId) => {
      if (!isAlchemyDevBuild()) return;
      mutateGearWithFlush(flush, (state) => {
        state.addInstance(generateDevRandomGearInstance(Math.random), characterId);
      });
    },
    [flush],
  );

  return useMemo(() => {
    const controller: ArmoryController = {
      inventories: gear.inventories,
      loadouts: gear.loadouts,
      craftingCurrencies: gear.craftingCurrencies,
      finishedRunCharacters,
      browseOnly: false,
      hasActiveRun,
      onEquip,
      onUnequip,
      onSalvage,
      onApplyCurrency,
      rng: Math.random,
    };
    if (isAlchemyDevBuild()) controller.onSpawnDevGear = onSpawnDevGear;
    return controller;
  }, [
    gear.inventories,
    gear.loadouts,
    gear.craftingCurrencies,
    finishedRunCharacters,
    hasActiveRun,
    onEquip,
    onUnequip,
    onSalvage,
    onApplyCurrency,
    onSpawnDevGear,
  ]);
}
