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
import { resolveActiveRunForSave } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import {
  dispatchGearMutationWithRunHealthSync,
  mutateGearWithRunHealthSync,
} from "@/features/alchemy/shared/stores/gear-session-command";
import { addMaterials, awardMaterialsDuringRun } from "@/features/alchemy/shared/stores/run-session-write-port";
import {
  useActiveRunCharacterId,
  useHasActiveBattle,
  useHasActiveRun,
} from "@/features/alchemy/shared/stores/run-session-react-ports";
import { useFinishedRunCharacters } from "@/features/alchemy/shared/stores/profile-store";
import { useGearArmorySlice } from "@/features/alchemy/shared/stores/gear-store";
import { useAppScreenChrome } from "@/app/app-screen-chrome-context";
import { flushAlchemySaveNow } from "@/features/alchemy/shared/storage/flush-save";
import type { GearStore } from "@/features/alchemy/shared/stores/gear-store-types";
import { isAlchemyDevBuild } from "@/features/alchemy/shared/utils";

function whenArmoryEditable(hasActiveBattle: boolean, run: () => void): void;
function whenArmoryEditable<T>(hasActiveBattle: boolean, run: () => T, fallback: T): T;
function whenArmoryEditable<T>(hasActiveBattle: boolean, run: () => T, fallback?: T): T | void {
  if (hasActiveBattle) return fallback;
  return run();
}

function mutateGearWithFlush<T>(
  characterId: CharacterId,
  flush: () => void,
  mutate: (state: GearStore) => T,
  options?: { flushOnSuccessOnly?: boolean },
): T {
  const result = dispatchGearMutationWithRunHealthSync({ characterId, mutate });
  if (options?.flushOnSuccessOnly ? result : true) flush();
  return result;
}

function runSessionWithFlush<T>(flush: () => void, command: () => T): T {
  const result = dispatchRunSessionCommand(command);
  flush();
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
}

export function useArmoryController(): ArmoryController {
  const { returnToRunScreen } = useAppScreenChrome();
  const gear = useGearArmorySlice();
  const finishedRunCharacters = useFinishedRunCharacters();
  const hasActiveBattle = useHasActiveBattle();
  const hasActiveRun = useHasActiveRun();
  const activeRunCharacterId = useActiveRunCharacterId();
  const rngRef = useRef<() => number>(() => Math.random());

  const flush = useCallback(() => {
    void flushAlchemySaveNow(resolveActiveRunForSave(hasActiveRun, returnToRunScreen ?? undefined));
  }, [hasActiveRun, returnToRunScreen]);

  const onEquip = useCallback<ArmoryController["onEquip"]>(
    (characterId, slot, instance) => {
      whenArmoryEditable(hasActiveBattle, () => {
        mutateGearWithFlush(activeRunCharacterId, flush, (state) => {
          state.equip(characterId, slot, instance);
        });
      });
    },
    [activeRunCharacterId, hasActiveBattle, flush],
  );

  const onUnequip = useCallback<ArmoryController["onUnequip"]>(
    (characterId, slot) => {
      whenArmoryEditable(hasActiveBattle, () => {
        mutateGearWithFlush(activeRunCharacterId, flush, (state) => {
          state.unequip(characterId, slot);
        });
      });
    },
    [activeRunCharacterId, hasActiveBattle, flush],
  );

  const onSalvage = useCallback<ArmoryController["onSalvage"]>(
    (instanceId, salvageYield) =>
      whenArmoryEditable(
        hasActiveBattle,
        () => {
          const result = dispatchRunSessionCommand((draft) => {
            const salvageResult = mutateGearWithRunHealthSync(draft, {
              characterId: activeRunCharacterId,
              mutate: (state) => state.salvage(instanceId, { yield: salvageYield }),
            });
            if (!salvageResult) return null;
            if (draft.session.hasActiveRun) {
              awardMaterialsDuringRun(draft, salvageResult.yieldedMaterials);
            } else {
              addMaterials(draft, salvageResult.yieldedMaterials);
            }
            return salvageResult;
          });
          if (result) flush();
          return Boolean(result);
        },
        false,
      ),
    [activeRunCharacterId, flush, hasActiveBattle],
  );

  const onApplyCurrency = useCallback<ArmoryController["onApplyCurrency"]>(
    (currencyId, instanceId) =>
      whenArmoryEditable(
        hasActiveBattle,
        () =>
          mutateGearWithFlush(
            activeRunCharacterId,
            flush,
            (state) => state.applyCurrency(currencyId, instanceId, { rng: rngRef.current }),
            { flushOnSuccessOnly: true },
          ),
        false,
      ),
    [activeRunCharacterId, flush, hasActiveBattle],
  );

  const onSpawnDevGear = useCallback<NonNullable<ArmoryController["onSpawnDevGear"]>>(
    (characterId) => {
      if (!isAlchemyDevBuild()) return;
      runSessionWithFlush(flush, () => gear.addInstance(generateDevRandomGearInstance(rngRef.current), characterId));
    },
    [flush, gear],
  );

  const controller: ArmoryController = {
    inventories: gear.inventories,
    loadouts: gear.loadouts,
    craftingCurrencies: gear.craftingCurrencies,
    finishedRunCharacters,
    browseOnly: hasActiveBattle,
    hasActiveRun,
    onEquip,
    onUnequip,
    onSalvage,
    onApplyCurrency,
  };
  if (isAlchemyDevBuild()) controller.onSpawnDevGear = onSpawnDevGear;
  return controller;
}
