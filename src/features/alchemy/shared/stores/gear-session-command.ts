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
import { discoverTrinketIds, discoverUniqueIds } from "./profile-store";
import { createReadonlyView, snapshotReadonlyValue } from "./readonly-view";
import type { RunTransaction } from "./run-session-command";
import { acceptCommand, rejectCommand, type SynchronousResult } from "./run-session-command";
import {
  addMaterialsToStockpile,
  addRunCurrenciesEarned,
  awardMaterialsDuringRun,
  rebindLiveRunMeta,
} from "./run-session-write-port";
import { transactionDraft } from "./transaction-internal";

// Salvage and crafting also reserve unequipped items owned by the battling
// hero. Equipping a shared spare on another hero uses only equipment locks.
function isInstanceLocked(state: GameplayDraft, instanceId: string): boolean {
  const restrictions = deriveGearCombatRestrictions(state);
  if (restrictions.gear[instanceId]) return true;
  const owner = findGearInventoryOwner(state.gear.inventories, instanceId);
  if (owner && restrictions.characters[owner]) return true;
  const equippedBy = findGearEquippedCharacter(state.gear.loadouts, instanceId);
  return Boolean(equippedBy && restrictions.characters[equippedBy]);
}

function gearCommandView(state: GameplayDraft, markMutated: () => void): GearDraftView {
  const gear = state.gear;
  const read = createReadonlyView(gear);
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
      const restrictions = deriveGearCombatRestrictions(state);
      if (restrictions.characters[characterId] || restrictions.gear[instance.instanceId]) return false;
      return wrote(equipGearInstance(gear, characterId, slot, instance));
    },
    unequip: (characterId, slot) => {
      if (deriveGearCombatRestrictions(state).characters[characterId]) return false;
      return wrote(unequipGearInstance(gear, characterId, slot));
    },
    addTrinket: (trinketId) => {
      const ok = wrote(addPermanentTrinket(gear, trinketId));
      if (ok) {
        discoverTrinketIds(state, [trinketId]);
      }
      return ok;
    },
    equipTrinket: (characterId, trinketId) => {
      const restrictions = deriveGearCombatRestrictions(state);
      if (restrictions.characters[characterId] || restrictions.trinkets[trinketId]) return false;
      return wrote(equipPermanentTrinket(gear, characterId, trinketId));
    },
    unequipTrinket: (characterId) => {
      if (deriveGearCombatRestrictions(state).characters[characterId]) return false;
      return wrote(unequipPermanentTrinket(gear, characterId));
    },
    applyCurrency: (currencyId, instanceId, options) => {
      if (isInstanceLocked(state, instanceId)) return false;
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
      const result = mutateGearWithRunHealthSync<T>(draft, options);
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

/** Removal, currencies, Materials, and run earnings share one authoritative recipe. */
export function salvageGearInTransaction(transaction: RunTransaction, instanceId: string) {
  const draft = transactionDraft(transaction);
  if (isInstanceLocked(draft, instanceId)) return null;
  const result = salvageGearInstance(draft.gear, instanceId);
  if (!result) return null;
  if (draft.session.activity.kind !== "inactive") {
    rebindLiveRunMeta(transaction);
    awardMaterialsDuringRun(transaction, result.yieldedMaterials);
    addRunCurrenciesEarned(transaction, result.yieldedCurrencies);
  } else {
    addMaterialsToStockpile(transaction, result.yieldedMaterials);
  }
  return result;
}

export function dispatchGearSalvageWithMaterialGrant(instanceId: string, gameSession: GameSession) {
  return dispatchGameplayCommand(
    (draft) => {
      const result = salvageGearInTransaction(draft, instanceId);
      return result ? acceptCommand(result) : rejectCommand("Gear cannot be salvaged", null);
    },
    undefined,
    gameSession,
  );
}
