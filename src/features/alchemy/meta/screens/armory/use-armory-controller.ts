import { useCallback, useRef } from "react";
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
import { useActiveRunCharacterId, useHasActiveRun } from "@/features/alchemy/shared/stores/run-session-react-ports";
import { useFinishedRunCharacters } from "@/features/alchemy/shared/stores/profile-store";
import { useGearArmorySlice } from "@/features/alchemy/shared/stores/gear-store";
import { useAppScreenChrome } from "@/app/app-screen-chrome-context";
import type { GearStore } from "@/features/alchemy/shared/stores/gear-store-types";
import { isAlchemyDevBuild } from "@/features/alchemy/shared/utils";

/** HP-sync uses the active-run hero; `mutate` may edit another character's loadout. */
function mutateGearWithFlush<T>(
  runHealthCharacterId: CharacterId,
  flush: () => void,
  mutate: (state: GearStore) => T,
  options?: { flushOnSuccessOnly?: boolean },
): T {
  const result = dispatchGearMutationWithRunHealthSync({ characterId: runHealthCharacterId, mutate });
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
  const activeRunCharacterId = useActiveRunCharacterId();
  const rngRef = useRef<() => number>(() => Math.random());

  const flush = useCallback(() => {
    flushSaveAfterGearMutation(resolveActiveRunForSave(hasActiveRun, returnToRunScreen ?? undefined));
  }, [hasActiveRun, returnToRunScreen]);

  const onEquip = useCallback<ArmoryController["onEquip"]>(
    (characterId, slot, instance) => {
      mutateGearWithFlush(activeRunCharacterId, flush, (state) => {
        state.equip(characterId, slot, instance);
      });
    },
    [activeRunCharacterId, flush],
  );

  const onUnequip = useCallback<ArmoryController["onUnequip"]>(
    (characterId, slot) => {
      mutateGearWithFlush(activeRunCharacterId, flush, (state) => {
        state.unequip(characterId, slot);
      });
    },
    [activeRunCharacterId, flush],
  );

  const onSalvage = useCallback<ArmoryController["onSalvage"]>(
    (instanceId, salvageYield) => {
      const result = dispatchGearSalvageWithMaterialGrant(activeRunCharacterId, (state) =>
        state.salvage(instanceId, { yield: salvageYield }),
      );
      if (result) flush();
      return Boolean(result);
    },
    [activeRunCharacterId, flush],
  );

  const onApplyCurrency = useCallback<ArmoryController["onApplyCurrency"]>(
    (currencyId, instanceId) =>
      mutateGearWithFlush(
        activeRunCharacterId,
        flush,
        (state) => state.applyCurrency(currencyId, instanceId, { rng: rngRef.current }),
        { flushOnSuccessOnly: true },
      ),
    [activeRunCharacterId, flush],
  );

  const onSpawnDevGear = useCallback<NonNullable<ArmoryController["onSpawnDevGear"]>>(
    (characterId) => {
      if (!isAlchemyDevBuild()) return;
      mutateGearWithFlush(characterId, flush, (state) => {
        state.addInstance(generateDevRandomGearInstance(rngRef.current), characterId);
      });
    },
    [flush],
  );

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
    rng: rngRef.current,
  };
  if (isAlchemyDevBuild()) controller.onSpawnDevGear = onSpawnDevGear;
  return controller;
}
