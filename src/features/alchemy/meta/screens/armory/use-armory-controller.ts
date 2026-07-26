import { useCallback, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import type { CharacterId } from "@/lib/game-data";
import {
  flattenGearInventories,
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
import { useGearStore } from "@/features/alchemy/shared/stores/gear-store";
import {
  useActiveRunCharacterId,
  useHasActiveBattle,
  useHasActiveRun,
} from "@/features/alchemy/shared/stores/run-session-facade";
import { useAppStore } from "@/features/alchemy/shared/stores/app-store";
import { useAppScreenChrome } from "@/app/app-screen-chrome-context";
import {
  resolveActiveRunForSave,
  syncRunMaxHealthFromGear,
  syncRunMaxHealthFromGearMutation,
} from "@/features/alchemy/shared/stores/run-transitions";
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
  const gear = useGearStore(
    useShallow((s) => ({
      inventories: s.inventories,
      loadouts: s.loadouts,
      gearBoardPositionsByCharacter: s.boardPositionsByCharacter,
      currencyBoardPositionsByCharacter: s.currencyBoardPositionsByCharacter,
      craftingCurrencies: s.craftingCurrencies,
      equip: s.equip,
      unequip: s.unequip,
      salvage: s.salvage,
      addInstance: s.addInstance,
      applyCurrency: s.applyCurrency,
      transferToInventory: s.transferToInventory,
      moveBoardItem: s.moveBoardItem,
      sortBoard: s.sortBoard,
    })),
  );
  const finishedRunCharacters = useAppStore((s) => s.finishedRunCharacters);
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
      const loadoutsBefore = gear.loadouts;
      gear.equip(characterId, slot, instance, options);
      if (hasActiveRun && characterId === activeRunCharacterId) {
        syncRunMaxHealthFromGear(
          characterId,
          flattenGearInventories(useGearStore.getState().inventories),
          loadoutsBefore,
          useGearStore.getState().loadouts,
        );
      }
      flush();
    },
    [activeRunCharacterId, gear, hasActiveBattle, hasActiveRun, flush],
  );

  const onUnequip = useCallback<ArmoryController["onUnequip"]>(
    (characterId, slot) => {
      if (hasActiveBattle) return;
      const loadoutsBefore = gear.loadouts;
      gear.unequip(characterId, slot);
      if (hasActiveRun && characterId === activeRunCharacterId) {
        syncRunMaxHealthFromGear(
          characterId,
          flattenGearInventories(useGearStore.getState().inventories),
          loadoutsBefore,
          useGearStore.getState().loadouts,
        );
      }
      flush();
    },
    [activeRunCharacterId, gear, hasActiveBattle, hasActiveRun, flush],
  );

  const onSalvage = useCallback<ArmoryController["onSalvage"]>(
    (instanceId) => {
      if (hasActiveBattle) return false;
      const inventoryBefore = flattenGearInventories(gear.inventories);
      const loadoutsBefore = gear.loadouts;
      const result = gear.salvage(instanceId, { rng: rngRef.current });
      if (!result) return false;
      if (hasActiveRun) {
        syncRunMaxHealthFromGearMutation(
          activeRunCharacterId,
          inventoryBefore,
          loadoutsBefore,
          flattenGearInventories(useGearStore.getState().inventories),
          useGearStore.getState().loadouts,
        );
      }
      flush();
      return true;
    },
    [activeRunCharacterId, flush, gear, hasActiveBattle, hasActiveRun],
  );

  const onTransferGear = useCallback<ArmoryController["onTransferGear"]>(
    (instanceId, targetCharacterId) => {
      if (hasActiveBattle) return false;
      const ok = gear.transferToInventory(instanceId, targetCharacterId);
      if (ok && hasActiveRun) {
        const inventoryAfter = flattenGearInventories(useGearStore.getState().inventories);
        const loadoutsAfter = useGearStore.getState().loadouts;
        syncRunMaxHealthFromGearMutation(
          activeRunCharacterId,
          flattenGearInventories(gear.inventories),
          gear.loadouts,
          inventoryAfter,
          loadoutsAfter,
        );
      }
      if (ok) flush();
      return ok;
    },
    [activeRunCharacterId, flush, gear, hasActiveBattle, hasActiveRun],
  );

  const onSortBoard = useCallback<ArmoryController["onSortBoard"]>(
    (characterId) => {
      if (hasActiveBattle) return;
      gear.sortBoard(characterId);
      flush();
    },
    [gear, hasActiveBattle, flush],
  );

  const onMoveBoardItem = useCallback<ArmoryController["onMoveBoardItem"]>(
    (characterId, item, col, row) => {
      if (hasActiveBattle) return false;
      const changed = gear.moveBoardItem(characterId, item, col, row);
      if (changed) flush();
      return changed;
    },
    [flush, gear, hasActiveBattle],
  );

  const onApplyCurrency = useCallback<ArmoryController["onApplyCurrency"]>(
    (currencyId, instanceId) => {
      if (hasActiveBattle) return false;
      const inventoryBefore = flattenGearInventories(gear.inventories);
      const loadoutsBefore = gear.loadouts;
      const ok = gear.applyCurrency(currencyId, instanceId, { rng: rngRef.current });
      if (ok) {
        if (hasActiveRun) {
          syncRunMaxHealthFromGearMutation(
            activeRunCharacterId,
            inventoryBefore,
            loadoutsBefore,
            flattenGearInventories(useGearStore.getState().inventories),
            useGearStore.getState().loadouts,
          );
        }
        flush();
      }
      return ok;
    },
    [activeRunCharacterId, flush, gear, hasActiveBattle, hasActiveRun],
  );

  const onSpawnDevGear = useCallback<NonNullable<ArmoryController["onSpawnDevGear"]>>(
    (characterId) => {
      if (!isAlchemyDevBuild()) return;
      gear.addInstance(generateDevRandomGearInstance(rngRef.current), characterId);
      flush();
    },
    [flush, gear],
  );

  const controller: ArmoryController = {
    inventories: gear.inventories,
    loadouts: gear.loadouts,
    gearBoardPositionsByCharacter: gear.gearBoardPositionsByCharacter,
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
