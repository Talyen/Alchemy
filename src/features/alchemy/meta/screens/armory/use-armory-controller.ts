import { defaultGameSession } from "@/app/application-session";
import type { CharacterId } from "@/lib/game-data";
import {
  generateDevRandomGearInstance,
  type CraftingCurrencyId,
  type GearInventories,
  type GearInstance,
  type GearLoadouts,
  type GearSlot,
  type EquippedTrinkets,
} from "@/lib/gear";
import { resolveActiveRunForSave, flushSaveAfterGearMutation } from "@/features/alchemy/shared/stores/run-lifecycle";
import { dispatchGearMutationWithRunHealthSync } from "@/features/alchemy/shared/stores/gear-session-command";

import { useFinishedRunCharacters } from "@/features/alchemy/shared/stores/profile-store";
import {
  useGearArmorySlice,
  useGearCombatRestrictions,
  type GearCombatRestrictions,
} from "@/features/alchemy/shared/stores/gear-store";
import { mutateGearWithFlush, salvageGearWithFlush } from "./armory-commands";
import type { GearDraftView } from "@/features/alchemy/shared/stores/gear-store-types";
import { isAlchemyDevBuild } from "@/features/alchemy/shared/utils";

function mutateGearWithFlushAlways(flush: () => void, mutate: (state: GearDraftView) => void): void {
  dispatchGearMutationWithRunHealthSync<void>({ mutate }, defaultGameSession);
  flush();
}

export interface ArmoryController {
  inventories: GearInventories;
  loadouts: GearLoadouts;
  ownedTrinketIds: string[];
  equippedTrinkets: EquippedTrinkets;
  craftingCurrencies: Record<CraftingCurrencyId, number>;
  finishedRunCharacters: CharacterId[];
  combatRestrictions: GearCombatRestrictions;
  onEquip: (characterId: CharacterId, slot: GearSlot, instance: GearInstance) => boolean;
  onUnequip: (characterId: CharacterId, slot: GearSlot) => void;
  onEquipTrinket: (characterId: CharacterId, trinketId: string) => void;
  onUnequipTrinket: (characterId: CharacterId) => void;
  onSalvage: (instanceId: string) => boolean;
  onApplyCurrency: (currencyId: CraftingCurrencyId, instanceId: string) => boolean;
  onSpawnDevGear?: (characterId: CharacterId) => void;
}

export function useArmoryController(options?: { rng?: () => number }): ArmoryController {
  const gear = useGearArmorySlice();
  const combatRestrictions = useGearCombatRestrictions();
  const finishedRunCharacters = useFinishedRunCharacters();
  // Profile-lifetime randomness is intentional here (see Docs/ARMORY.md): crafting
  // and dev spawning must not consume a run RNG stream. Gear actions still require
  // an explicit rng so the source stays visible at the call site.
  const rng = options?.rng ?? Math.random;

  const flush = () => flushSaveAfterGearMutation(resolveActiveRunForSave(defaultGameSession), defaultGameSession);
  const controller: ArmoryController = {
    ...gear,
    finishedRunCharacters,
    combatRestrictions,
    onEquip: (characterId, slot, instance) =>
      mutateGearWithFlush(flush, (state) => state.equip(characterId, slot, instance), defaultGameSession),
    onUnequip: (characterId, slot) => {
      mutateGearWithFlush(flush, (state) => state.unequip(characterId, slot), defaultGameSession);
    },
    onEquipTrinket: (characterId, trinketId) => {
      mutateGearWithFlush(flush, (state) => state.equipTrinket(characterId, trinketId), defaultGameSession);
    },
    onUnequipTrinket: (characterId) => {
      mutateGearWithFlush(flush, (state) => state.unequipTrinket(characterId), defaultGameSession);
    },
    // The store recomputes the deterministic yield shown in the confirmation.
    onSalvage: (instanceId) => salvageGearWithFlush(flush, instanceId, defaultGameSession),
    onApplyCurrency: (currencyId, instanceId) =>
      mutateGearWithFlush(flush, (state) => state.applyCurrency(currencyId, instanceId, { rng }), defaultGameSession),
  };
  if (isAlchemyDevBuild()) {
    controller.onSpawnDevGear = (characterId) => {
      if (!isAlchemyDevBuild()) return;
      mutateGearWithFlushAlways(flush, (state) => {
        state.addInstance(generateDevRandomGearInstance(rng), characterId);
      });
    };
  }
  return controller;
}
