import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { findGearEquippedCharacter, findGearInventoryOwner, gearDefinitions } from "@/lib/gear";
import { dispatchGameplayCommand, type GameplayDraft } from "./gameplay-command";
import {
  addGearCurrencies,
  addGearInstance,
  addPermanentTrinket,
  applyGearCurrency,
  equipGearInstance,
  equipPermanentTrinket,
  initializeGear,
  resetGear,
  salvageGearInstance,
  unequipGearInstance,
  unequipPermanentTrinket,
} from "./gear-actions";
import { deriveGearCombatRestrictions } from "./gear-combat-restrictions";
import type { GearDraftView } from "./gear-store-types";
import { discoverUniqueIds } from "./profile-store";
import { createReadonlyView, snapshotReadonlyValue, unwrapReadonlyValue } from "./readonly-view";
import type { RunTransaction } from "./run-session-command";
import { acceptCommand, rejectCommand, type SynchronousResult } from "./run-session-command";
import {
  addMaterialsToStockpile,
  addRunCurrenciesEarned,
  awardMaterialsDuringRun,
  rebindLiveRunMeta,
} from "./run-session-write-port";
import { transactionDraft } from "./transaction-internal";

function gearCommandView(state: GameplayDraft, markMutated: () => void): GearDraftView {
  const gear = state.gear;
  const read = createReadonlyView(gear);
  const restrictions = deriveGearCombatRestrictions(state);
  // Second tier of the lock policy (see deriveGearCombatRestrictions):
  // restrictions.gear only tracks equipped items of the locked hero; an
  // unequipped item sitting in their inventory is locked too — for salvage and
  // currency application, but NOT for equipping elsewhere.
  const isInstanceLocked = (instanceId: string): boolean => {
    if (restrictions.gear[instanceId]) return true;
    const owner = findGearInventoryOwner(gear.inventories, instanceId);
    if (owner && restrictions.characters[owner]) return true;
    const equippedBy = findGearEquippedCharacter(gear.loadouts, instanceId);
    if (equippedBy && restrictions.characters[equippedBy]) return true;
    return false;
  };
  // Void actions always write; boolean actions report success. Either way the
  // view records actual writes explicitly so commands know whether live battle
  // meta needs rebinding — no snapshot comparison required.
  const wrote = <T>(result: T): T => {
    if (result) markMutated();
    return result;
  };
  return {
    get inventories() {
      return read.inventories;
    },
    get loadouts() {
      return read.loadouts;
    },
    get ownedTrinketIds() {
      return read.ownedTrinketIds;
    },
    get equippedTrinkets() {
      return read.equippedTrinkets;
    },
    get craftingCurrencies() {
      return read.craftingCurrencies;
    },
    initialize: (inventories, loadouts, craftingCurrencies, ownedTrinketIds, equippedTrinkets) => {
      if (state.session.activity.kind === "battle") throw new Error("Cannot initialize Gear during combat");
      markMutated();
      initializeGear(
        gear,
        snapshotReadonlyValue(inventories),
        snapshotReadonlyValue(loadouts),
        craftingCurrencies,
        ownedTrinketIds ? [...ownedTrinketIds] : undefined,
        equippedTrinkets ? snapshotReadonlyValue(equippedTrinkets) : undefined,
      );
    },
    addInstance: (instance, characterId) => {
      markMutated();
      addGearInstance(gear, instance, characterId);
      if (gearDefinitions[instance.definitionId]?.rarity === "unique") {
        discoverUniqueIds(state, [instance.definitionId]);
      }
    },
    equip: (characterId, slot, instance) => {
      if (restrictions.characters[characterId] || restrictions.gear[instance.instanceId]) return false;
      return wrote(equipGearInstance(gear, characterId, slot, instance));
    },
    unequip: (characterId, slot) => {
      if (restrictions.characters[characterId]) return false;
      return wrote(unequipGearInstance(gear, characterId, slot));
    },
    addTrinket: (trinketId) => wrote(addPermanentTrinket(gear, trinketId)),
    equipTrinket: (characterId, trinketId) => {
      if (restrictions.characters[characterId] || restrictions.trinkets[trinketId]) return false;
      return wrote(equipPermanentTrinket(gear, characterId, trinketId));
    },
    unequipTrinket: (characterId) => {
      if (restrictions.characters[characterId]) return false;
      return wrote(unequipPermanentTrinket(gear, characterId));
    },
    salvage: (instanceId) => {
      if (isInstanceLocked(instanceId)) return null;
      const result = salvageGearInstance(gear, instanceId);
      if (result) markMutated();
      return result;
    },
    applyCurrency: (currencyId, instanceId, options) => {
      if (isInstanceLocked(instanceId)) return false;
      return wrote(applyGearCurrency(gear, currencyId, instanceId, options));
    },
    addCurrencies: (currencies) => {
      markMutated();
      addGearCurrencies(gear, currencies);
    },
    reset: () => {
      if (state.session.activity.kind === "battle") throw new Error("Cannot reset Gear during combat");
      markMutated();
      resetGear(gear);
    },
  };
}

export function dispatchGearMutationWithRunHealthSync<T>(
  options: {
    mutate: (gear: GearDraftView) => T & SynchronousResult<T>;
  },
  gameSession: GameSession,
): T {
  return dispatchGameplayCommand<T>(
    (draft) => {
      const result = unwrapReadonlyValue(mutateGearWithRunHealthSync<T>(draft, options));
      return result === false || result === null
        ? rejectCommand<T>("Gear action was rejected", result)
        : acceptCommand<T>(result);
    },
    undefined,
    gameSession,
  );
}

export function mutateGearWithRunHealthSync<T>(
  transaction: RunTransaction,
  options: {
    mutate: (gear: GearDraftView) => T & SynchronousResult<T>;
  },
): T & SynchronousResult<T> {
  const draft = transactionDraft(transaction);
  let mutated = false;
  const result = options.mutate(
    gearCommandView(draft, () => {
      mutated = true;
    }),
  );
  if (mutated && draft.session.activity.kind !== "inactive") {
    rebindLiveRunMeta(draft);
  }
  return result;
}

export function dispatchGearSalvageWithMaterialGrant(
  mutate: (gear: GearDraftView) => ReturnType<GearDraftView["salvage"]>,
  gameSession: GameSession,
): ReturnType<GearDraftView["salvage"]> {
  return dispatchGameplayCommand(
    (draft) => {
      const salvageResult = mutateGearWithRunHealthSync(draft, { mutate });
      if (!salvageResult) return rejectCommand("Gear cannot be salvaged", null);
      if (draft.session.activity.kind !== "inactive") {
        awardMaterialsDuringRun(draft, salvageResult.yieldedMaterials);
        addRunCurrenciesEarned(draft, salvageResult.yieldedCurrencies);
      } else {
        addMaterialsToStockpile(draft, salvageResult.yieldedMaterials);
      }
      return acceptCommand(salvageResult);
    },
    undefined,
    gameSession,
  );
}
