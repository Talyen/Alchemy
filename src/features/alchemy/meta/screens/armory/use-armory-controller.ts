import { useCallback, useRef } from "react";
import type { CharacterId } from "@/lib/game-data";
import {
  generateDevRandomGearInstance,
  type BoardItemRef,
  type CraftingCurrencyBoardPositionsByCharacter,
  type CraftingCurrencyId,
  type GearBoardPositionsByCharacter,
  type GearInventories,
  type GearInstance,
  type GearLoadouts,
  type GearSlot,
  type InventoryPlacement,
} from "@/lib/gear";
import { resolveActiveRunForSave } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { dispatchGearMutationWithRunHealthSync } from "@/features/alchemy/shared/stores/gear-session-command";
import {
  useActiveRunCharacterId,
  useHasActiveBattle,
  useHasActiveRun,
} from "@/features/alchemy/shared/stores/run-session-react-ports";
import { useFinishedRunCharacters } from "@/features/alchemy/shared/stores/profile-port";
import { useGearArmorySlice } from "@/features/alchemy/shared/stores/gear-read-port";
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

function runSessionWithFlush<T>(flush: () => void, command: () => T, options?: { flushOnSuccessOnly?: boolean }): T {
  const result = dispatchRunSessionCommand(command);
  if (options?.flushOnSuccessOnly ? result : true) flush();
  return result;
}

export interface ArmoryController {
  inventories: GearInventories;
  loadouts: GearLoadouts;
  gearBoardPositionsByCharacter: GearBoardPositionsByCharacter;
  currencyBoardPositionsByCharacter: CraftingCurrencyBoardPositionsByCharacter;
  craftingCurrencies: Record<CraftingCurrencyId, number>;
  finishedRunCharacters: CharacterId[];
  browseOnly: boolean;
  hasActiveRun: boolean;
  onEquip: (
    characterId: CharacterId,
    slot: GearSlot,
    instance: GearInstance,
    options?: { vacatedPlacement?: InventoryPlacement; swapDisplaced?: boolean },
  ) => void;
  onUnequip: (characterId: CharacterId, slot: GearSlot) => void;
  onSalvage: (instanceId: string) => boolean;
  onTransferGear: (instanceId: string, targetCharacterId: CharacterId) => boolean;
  onApplyCurrency: (currencyId: CraftingCurrencyId, instanceId: string) => boolean;
  onMoveBoardItem: (characterId: CharacterId, item: BoardItemRef, col: number, row: number) => boolean;
  onSpawnDevGear?: (characterId: CharacterId) => void;
  onSortBoard: (characterId: CharacterId) => void;
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
    (characterId, slot, instance, options) => {
      whenArmoryEditable(hasActiveBattle, () => {
        mutateGearWithFlush(activeRunCharacterId, flush, (state) => {
          state.equip(characterId, slot, instance, options);
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
    (instanceId) =>
      whenArmoryEditable(
        hasActiveBattle,
        () => {
          const result = mutateGearWithFlush(
            activeRunCharacterId,
            flush,
            (state) => state.salvage(instanceId, { rng: rngRef.current }),
            { flushOnSuccessOnly: true },
          );
          return Boolean(result);
        },
        false,
      ),
    [activeRunCharacterId, flush, hasActiveBattle],
  );

  const onTransferGear = useCallback<ArmoryController["onTransferGear"]>(
    (instanceId, targetCharacterId) =>
      whenArmoryEditable(
        hasActiveBattle,
        () =>
          mutateGearWithFlush(
            activeRunCharacterId,
            flush,
            (state) => state.transferToInventory(instanceId, targetCharacterId),
            { flushOnSuccessOnly: true },
          ),
        false,
      ),
    [activeRunCharacterId, flush, hasActiveBattle],
  );

  const onSortBoard = useCallback<ArmoryController["onSortBoard"]>(
    (characterId) => {
      whenArmoryEditable(hasActiveBattle, () => {
        runSessionWithFlush(flush, () => gear.sortBoard(characterId));
      });
    },
    [gear, hasActiveBattle, flush],
  );

  const onMoveBoardItem = useCallback<ArmoryController["onMoveBoardItem"]>(
    (characterId, item, col, row) =>
      whenArmoryEditable(
        hasActiveBattle,
        () =>
          runSessionWithFlush(flush, () => gear.moveBoardItem(characterId, item, col, row), {
            flushOnSuccessOnly: true,
          }),
        false,
      ),
    [flush, gear, hasActiveBattle],
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
    gearBoardPositionsByCharacter: gear.boardPositionsByCharacter,
    currencyBoardPositionsByCharacter: gear.currencyBoardPositionsByCharacter,
    craftingCurrencies: gear.craftingCurrencies,
    finishedRunCharacters,
    browseOnly: hasActiveBattle,
    hasActiveRun,
    onEquip,
    onUnequip,
    onSalvage,
    onTransferGear,
    onApplyCurrency,
    onMoveBoardItem,
    onSortBoard,
  };
  if (isAlchemyDevBuild()) controller.onSpawnDevGear = onSpawnDevGear;
  return controller;
}
