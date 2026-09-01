import { useCallback, useMemo } from "react";
import type { CharacterId } from "@/lib/game-data";
import {
  generateDevRandomGearInstance,
  type CraftingCurrencyId,
  type GearInventories,
  type GearInstance,
  type GearLoadouts,
  type GearSlot,
  type EquippedTrinkets,
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
import { useHasActiveRun } from "@/features/alchemy/shared/stores/run-reads";
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
  ownedTrinketIds: string[];
  equippedTrinkets: EquippedTrinkets;
  craftingCurrencies: Record<CraftingCurrencyId, number>;
  finishedRunCharacters: CharacterId[];
  browseOnly: boolean;
  hasActiveRun: boolean;
  onEquip: (characterId: CharacterId, slot: GearSlot, instance: GearInstance) => void;
  onUnequip: (characterId: CharacterId, slot: GearSlot) => void;
  onEquipTrinket: (characterId: CharacterId, trinketId: string) => void;
  onUnequipTrinket: (characterId: CharacterId) => void;
  onSalvage: (instanceId: string, salvageYield: SalvageYield) => boolean;
  onApplyCurrency: (currencyId: CraftingCurrencyId, instanceId: string) => boolean;
  onSpawnDevGear?: (characterId: CharacterId) => void;
  rng: () => number;
}

export function useArmoryController(options?: { rng?: () => number }): ArmoryController {
  const { returnToRunScreen } = useAppScreenChrome();
  const gear = useGearArmorySlice();
  const finishedRunCharacters = useFinishedRunCharacters();
  const hasActiveRun = useHasActiveRun();
  const rng = options?.rng ?? Math.random;

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

  const onEquipTrinket = useCallback<ArmoryController["onEquipTrinket"]>(
    (characterId, trinketId) => {
      mutateGearWithFlush(flush, (state) => state.equipTrinket(characterId, trinketId));
    },
    [flush],
  );

  const onUnequipTrinket = useCallback<ArmoryController["onUnequipTrinket"]>(
    (characterId) => {
      mutateGearWithFlush(flush, (state) => state.unequipTrinket(characterId));
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
      mutateGearWithFlush(flush, (state) => state.applyCurrency(currencyId, instanceId, { rng }), {
        flushOnSuccessOnly: true,
      }),
    [flush, rng],
  );

  const onSpawnDevGear = useCallback<NonNullable<ArmoryController["onSpawnDevGear"]>>(
    (characterId) => {
      if (!isAlchemyDevBuild()) return;
      mutateGearWithFlush(flush, (state) => {
        state.addInstance(generateDevRandomGearInstance(rng), characterId);
      });
    },
    [flush, rng],
  );

  return useMemo(() => {
    const controller: ArmoryController = {
      inventories: gear.inventories,
      loadouts: gear.loadouts,
      ownedTrinketIds: gear.ownedTrinketIds,
      equippedTrinkets: gear.equippedTrinkets,
      craftingCurrencies: gear.craftingCurrencies,
      finishedRunCharacters,
      browseOnly: false,
      hasActiveRun,
      onEquip,
      onUnequip,
      onEquipTrinket,
      onUnequipTrinket,
      onSalvage,
      onApplyCurrency,
      rng,
    };
    if (isAlchemyDevBuild()) controller.onSpawnDevGear = onSpawnDevGear;
    return controller;
  }, [
    gear.inventories,
    gear.loadouts,
    gear.ownedTrinketIds,
    gear.equippedTrinkets,
    gear.craftingCurrencies,
    finishedRunCharacters,
    hasActiveRun,
    onEquip,
    onUnequip,
    onEquipTrinket,
    onUnequipTrinket,
    onSalvage,
    onApplyCurrency,
    onSpawnDevGear,
    rng,
  ]);
}
