import { useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import type { CharacterId } from "@/lib/game-data";
import {
  flattenGearInventories,
  generateDevRandomGearInstance,
  type CraftingCurrencyId,
  type GearInventories,
  type GearInstance,
  type GearLoadouts,
  type GearSlot,
  type InventoryPlacement,
} from "@/lib/gear";
import { useGearStore } from "@/features/alchemy/shared/stores/gear-store";
import { useRunDomainStore } from "@/features/alchemy/shared/stores/run-session-facade";
import { useAppStore } from "@/features/alchemy/shared/stores/app-store";
import { useAppScreenChrome } from "@/app/app-screen-chrome-context";
import {
  resolveActiveRunForSave,
  syncRunMaxHealthFromGear,
  syncRunMaxHealthFromGearMutation,
} from "@/features/alchemy/shared/stores/run-transitions";
import { flushAlchemySaveNow } from "@/features/alchemy/shared/storage/flush-save";
import { isAlchemyDevBuild } from "@/features/alchemy/shared/utils/dev-mode";

export type ArmoryController = {
  inventories: GearInventories;
  loadouts: GearLoadouts;
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
  onSalvage: (instanceId: string) => void;
  onApplyCurrency: (currencyId: CraftingCurrencyId, instanceId: string) => boolean;
  onSpawnDevGear?: (characterId: CharacterId) => void;
};

export function useArmoryController(): ArmoryController {
  const { returnToRunScreen } = useAppScreenChrome();
  const gear = useGearStore(
    useShallow((s) => ({
      inventories: s.inventories,
      loadouts: s.loadouts,
      craftingCurrencies: s.craftingCurrencies,
      equip: s.equip,
      unequip: s.unequip,
      salvage: s.salvage,
      addInstance: s.addInstance,
      applyCurrency: s.applyCurrency,
    })),
  );
  const finishedRunCharacters = useAppStore((s) => s.finishedRunCharacters);
  const hasActiveBattle = useRunDomainStore((s) => s.battle.hasActiveBattle);
  const hasActiveRun = useRunDomainStore((s) => s.session.hasActiveRun);
  const activeRunCharacterId = useRunDomainStore((s) => s.progress.characterId);

  const flush = useCallback(() => {
    void flushAlchemySaveNow(resolveActiveRunForSave(hasActiveRun, returnToRunScreen ?? undefined));
  }, [hasActiveRun, returnToRunScreen]);

  const onEquip = useCallback<ArmoryController["onEquip"]>(
    (characterId, slot, instance, options) => {
      if (hasActiveBattle) return;
      const loadoutsBefore = gear.loadouts;
      gear.equip(characterId, slot, instance, options);
      if (hasActiveRun && !hasActiveBattle && characterId === activeRunCharacterId) {
        syncRunMaxHealthFromGear(
          characterId,
          flattenGearInventories(gear.inventories),
          loadoutsBefore,
          useGearStore.getState().loadouts,
        );
      }
    },
    [activeRunCharacterId, gear, hasActiveBattle, hasActiveRun],
  );

  const onUnequip = useCallback<ArmoryController["onUnequip"]>(
    (characterId, slot) => {
      if (hasActiveBattle) return;
      const loadoutsBefore = gear.loadouts;
      gear.unequip(characterId, slot);
      if (hasActiveRun && !hasActiveBattle && characterId === activeRunCharacterId) {
        syncRunMaxHealthFromGear(
          characterId,
          flattenGearInventories(gear.inventories),
          loadoutsBefore,
          useGearStore.getState().loadouts,
        );
      }
    },
    [activeRunCharacterId, gear, hasActiveBattle, hasActiveRun],
  );

  const onSalvage = useCallback<ArmoryController["onSalvage"]>(
    (instanceId) => {
      if (hasActiveBattle) return;
      const inventoryBefore = flattenGearInventories(gear.inventories);
      const loadoutsBefore = gear.loadouts;
      const result = gear.salvage(instanceId);
      if (!result) return;
      if (hasActiveRun) {
        syncRunMaxHealthFromGearMutation(
          activeRunCharacterId,
          inventoryBefore,
          loadoutsBefore,
          flattenGearInventories(gear.inventories),
          useGearStore.getState().loadouts,
        );
      }
      flush();
    },
    [activeRunCharacterId, flush, gear, hasActiveBattle, hasActiveRun],
  );

  const onApplyCurrency = useCallback<ArmoryController["onApplyCurrency"]>(
    (currencyId, instanceId) => {
      if (hasActiveBattle) return false;
      const inventoryBefore = flattenGearInventories(gear.inventories);
      const loadoutsBefore = gear.loadouts;
      const ok = gear.applyCurrency(currencyId as Parameters<typeof gear.applyCurrency>[0], instanceId);
      if (ok) {
        if (hasActiveRun) {
          syncRunMaxHealthFromGearMutation(
            activeRunCharacterId,
            inventoryBefore,
            loadoutsBefore,
            flattenGearInventories(gear.inventories),
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
      gear.addInstance(generateDevRandomGearInstance(), characterId);
      flush();
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
