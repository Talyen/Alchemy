import { type GameSession } from "@/features/alchemy/shared/stores/session/game-session-types";
import { assertSynchronousResult } from "./command-outcome";
import {
  findEmptyGearSlot,
  findGearEquippedCharacter,
  findGearInventoryOwner,
  flattenGearInventories,
  gearDefinitions,
  type GearInstance,
} from "@/lib/gear";
import {
  abortGameplayCommand,
  dispatchGameplayCommand,
  gameplayDraftRuntime,
  type GameplayDraft,
} from "../session/gameplay-command";
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
import { deriveGearCombatRestrictions } from "../session/gear-combat-restrictions";
import type { GearDraftView } from "../session/gear-store-types";
import { discoverTrinketIds, discoverUniqueIds } from "../session/profile-store";
import { createReadonlyView, snapshotReadonlyValue } from "../session/readonly-view";
import type { RunTransaction } from "./run-session-command";
import { acceptCommand, rejectCommand, type SynchronousResult } from "./run-session-command";
import {
  addMaterialsToStockpile,
  addRunCurrenciesEarned,
  awardMaterialsDuringRun,
  rebindLiveRunMeta,
} from "./run-session-write-port";
import { transactionDraft } from "../session/transaction-internal";

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

export function acquireGearDuringRun(transaction: RunTransaction, instance: GearInstance): void {
  const draft = transactionDraft(transaction);
  const characterId = draft.run.activeRun.characterId;
  const autoEquip = gameplayDraftRuntime(draft).settings.getState().autoEquip;
  mutateGearWithRunHealthSync(transaction, {
    mutate: (gear) => {
      gear.addInstance(instance, characterId);
      const definition = gearDefinitions[instance.definitionId];
      if (!autoEquip || !definition) return;
      const slot = findEmptyGearSlot(
        definition,
        draft.gear.loadouts[characterId],
        flattenGearInventories(draft.gear.inventories),
      );
      if (slot) gear.equip(characterId, slot, instance);
    },
  });
}

export function acquireTrinketDuringRun(transaction: RunTransaction, trinketId: string): boolean {
  const draft = transactionDraft(transaction);
  const characterId = draft.run.activeRun.characterId;
  const autoEquip = gameplayDraftRuntime(draft).settings.getState().autoEquip;
  return mutateGearWithRunHealthSync(transaction, {
    mutate: (gear) => {
      const added = gear.addTrinket(trinketId);
      if (added && autoEquip && !gear.equippedTrinkets[characterId]) gear.equipTrinket(characterId, trinketId);
      return added;
    },
  });
}

function gearCommandView(state: GameplayDraft, markMutated: () => void, assertOpen: () => void): GearDraftView {
  const gear = state.gear;
  const read = createReadonlyView(gear);
  const mutation = <Args extends unknown[], Result>(operation: (...args: Args) => Result) => {
    return (...args: Args): Result => {
      assertOpen();
      return operation(...args);
    };
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
    initialize: mutation((inventories, loadouts, craftingCurrencies, ownedTrinketIds, equippedTrinkets) => {
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
    }),
    addInstance: mutation((instance, characterId) => {
      markMutated();
      addGearInstance(gear, instance, characterId);
      if (gearDefinitions[instance.definitionId]?.rarity === "unique") {
        discoverUniqueIds(state, [instance.definitionId]);
      }
    }),
    equip: mutation((characterId, slot, instance) => {
      const restrictions = deriveGearCombatRestrictions(state);
      if (restrictions.characters[characterId] || restrictions.gear[instance.instanceId]) return false;
      return wrote(equipGearInstance(gear, characterId, slot, instance));
    }),
    unequip: mutation((characterId, slot) => {
      if (deriveGearCombatRestrictions(state).characters[characterId]) return false;
      return wrote(unequipGearInstance(gear, characterId, slot));
    }),
    addTrinket: mutation((trinketId) => {
      const ok = wrote(addPermanentTrinket(gear, trinketId));
      if (ok) {
        discoverTrinketIds(state, [trinketId]);
      }
      return ok;
    }),
    equipTrinket: mutation((characterId, trinketId) => {
      const restrictions = deriveGearCombatRestrictions(state);
      if (restrictions.characters[characterId] || restrictions.trinkets[trinketId]) return false;
      return wrote(equipPermanentTrinket(gear, characterId, trinketId));
    }),
    unequipTrinket: mutation((characterId) => {
      if (deriveGearCombatRestrictions(state).characters[characterId]) return false;
      return wrote(unequipPermanentTrinket(gear, characterId));
    }),
    applyCurrency: mutation((currencyId, instanceId, options) => {
      if (isInstanceLocked(state, instanceId)) return false;
      return wrote(applyGearCurrency(gear, currencyId, instanceId, options));
    }),
    addCurrencies: mutation((currencies) => {
      markMutated();
      addGearCurrencies(gear, currencies);
    }),
    reset: mutation(() => {
      if (state.session.activity.kind === "battle") throw new Error("Cannot reset Gear during combat");
      markMutated();
      resetGear(gear);
    }),
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
  let open = true;
  try {
    let result: T & SynchronousResult<T>;
    try {
      result = options.mutate(
        gearCommandView(
          draft,
          () => {
            mutated = true;
          },
          () => {
            if (!open) throw new Error("Gear writes require a current Gear mutation");
          },
        ),
      );
      // The outer command may ignore this result; this boundary must validate it.
      assertSynchronousResult(result);
    } finally {
      // Close before rebinding, even if the callback failed and the caller catches it.
      open = false;
    }
    if (mutated && draft.session.activity.kind !== "inactive") {
      rebindLiveRunMeta(draft);
    }
    return result;
  } catch (error) {
    abortGameplayCommand(draft, error);
  }
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
