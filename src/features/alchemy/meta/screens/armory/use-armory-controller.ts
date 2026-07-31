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
import { isAlchemyDevBuild } from "@/features/alchemy/shared/utils";

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
      if (hasActiveBattle) return;
      dispatchGearMutationWithRunHealthSync({
        characterId: activeRunCharacterId,
        mutate: (state) => {
          state.equip(characterId, slot, instance, options);
        },
      });
      flush();
    },
    [activeRunCharacterId, hasActiveBattle, flush],
  );

  const onUnequip = useCallback<ArmoryController["onUnequip"]>(
    (characterId, slot) => {
      if (hasActiveBattle) return;
      dispatchGearMutationWithRunHealthSync({
        characterId: activeRunCharacterId,
        mutate: (state) => {
          state.unequip(characterId, slot);
        },
      });
      flush();
    },
    [activeRunCharacterId, hasActiveBattle, flush],
  );

  const onSalvage = useCallback<ArmoryController["onSalvage"]>(
    (instanceId) => {
      if (hasActiveBattle) return false;
      const result = dispatchGearMutationWithRunHealthSync({
        characterId: activeRunCharacterId,
        mutate: (state) => state.salvage(instanceId, { rng: rngRef.current }),
      });
      if (!result) return false;
      flush();
      return true;
    },
    [activeRunCharacterId, flush, hasActiveBattle],
  );

  const onTransferGear = useCallback<ArmoryController["onTransferGear"]>(
    (instanceId, targetCharacterId) => {
      if (hasActiveBattle) return false;
      const ok = dispatchGearMutationWithRunHealthSync({
        characterId: activeRunCharacterId,
        mutate: (state) => state.transferToInventory(instanceId, targetCharacterId),
      });
      if (ok) flush();
      return ok;
    },
    [activeRunCharacterId, flush, hasActiveBattle],
  );

  const onSortBoard = useCallback<ArmoryController["onSortBoard"]>(
    (characterId) => {
      if (hasActiveBattle) return;
      dispatchRunSessionCommand(() => gear.sortBoard(characterId));
      flush();
    },
    [gear, hasActiveBattle, flush],
  );

  const onMoveBoardItem = useCallback<ArmoryController["onMoveBoardItem"]>(
    (characterId, item, col, row) => {
      if (hasActiveBattle) return false;
      const changed = dispatchRunSessionCommand(() => gear.moveBoardItem(characterId, item, col, row));
      if (changed) flush();
      return changed;
    },
    [flush, gear, hasActiveBattle],
  );

  const onApplyCurrency = useCallback<ArmoryController["onApplyCurrency"]>(
    (currencyId, instanceId) => {
      if (hasActiveBattle) return false;
      const ok = dispatchGearMutationWithRunHealthSync({
        characterId: activeRunCharacterId,
        mutate: (state) => state.applyCurrency(currencyId, instanceId, { rng: rngRef.current }),
      });
      if (ok) {
        flush();
      }
      return ok;
    },
    [activeRunCharacterId, flush, hasActiveBattle],
  );

  const onSpawnDevGear = useCallback<NonNullable<ArmoryController["onSpawnDevGear"]>>(
    (characterId) => {
      if (!isAlchemyDevBuild()) return;
      dispatchRunSessionCommand(() => gear.addInstance(generateDevRandomGearInstance(rngRef.current), characterId));
      flush();
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
