import type { CharacterId } from "@/lib/game-data";
import { trinketLibrary } from "@/lib/game-data";
import type { CraftingCurrencyId, GearInstance, GearSlot } from "@/lib/gear";
import { generateDevRandomGearInstance } from "@/lib/gear";
import type { GameSession } from "./game-session-types";
import { mutateGearWithRunHealthSync, salvageGearInTransaction } from "./gear-session-command";
import type { GearDraftView } from "./gear-store-types";
import { flushSaveAfterGearMutation } from "./run-lifecycle";
import { acceptCommand, rejectCommand, dispatchRunSessionCommand } from "./run-session-command";
import { isAlchemyDevBuild } from "../utils";

// The action owns both the mutation and its save checkpoint. Adapters receive
// only intent commands, never a draft callback or a caller-supplied flush.
function commitArmoryAction(mutate: (gear: GearDraftView) => boolean, gameSession: GameSession): boolean {
  return dispatchRunSessionCommand(
    (transaction) => {
      const result = mutateGearWithRunHealthSync(transaction, { mutate });
      return result ? acceptCommand(true) : rejectCommand("Gear action was rejected", false);
    },
    { afterCommit: () => flushSaveAfterGearMutation(gameSession) },
    gameSession,
  );
}

export function equipGear(
  characterId: CharacterId,
  slot: GearSlot,
  instance: GearInstance,
  gameSession: GameSession,
): boolean {
  return commitArmoryAction((state) => state.equip(characterId, slot, instance), gameSession);
}

export function unequipGear(characterId: CharacterId, slot: GearSlot, gameSession: GameSession): boolean {
  return commitArmoryAction((state) => state.unequip(characterId, slot), gameSession);
}

export function equipTrinket(characterId: CharacterId, trinketId: string, gameSession: GameSession): boolean {
  return commitArmoryAction((state) => state.equipTrinket(characterId, trinketId), gameSession);
}

export function unequipTrinket(characterId: CharacterId, gameSession: GameSession): boolean {
  return commitArmoryAction((state) => state.unequipTrinket(characterId), gameSession);
}

export function salvageGear(instanceId: string, gameSession: GameSession): boolean {
  return dispatchRunSessionCommand(
    (transaction) => {
      const result = salvageGearInTransaction(transaction, instanceId);
      return result ? acceptCommand(true) : rejectCommand("Gear cannot be salvaged", false);
    },
    { afterCommit: () => flushSaveAfterGearMutation(gameSession) },
    gameSession,
  );
}

export function applyCurrencyToGear(
  currencyId: CraftingCurrencyId,
  instanceId: string,
  options: { rng?: () => number } | undefined,
  gameSession: GameSession,
): boolean {
  const rng = options?.rng ?? Math.random;
  return commitArmoryAction((state) => state.applyCurrency(currencyId, instanceId, { rng }), gameSession);
}

export function spawnDevGear(
  characterId: CharacterId,
  options: { rng?: () => number } | undefined,
  gameSession: GameSession,
): void {
  if (!isAlchemyDevBuild()) return;
  const rng = options?.rng ?? Math.random;
  commitArmoryAction((gear) => {
    gear.addInstance(generateDevRandomGearInstance(rng), characterId);
    return true;
  }, gameSession);
}

export function spawnDevTrinket(options: { rng?: () => number } | undefined, gameSession: GameSession): void {
  if (!isAlchemyDevBuild()) return;
  const rng = options?.rng ?? Math.random;
  commitArmoryAction((gear) => {
    const owned = new Set(gear.ownedTrinketIds);
    const available = trinketLibrary.filter((entry) => !owned.has(entry.id));
    if (available.length === 0) return false;
    const choice = available[Math.floor(rng() * available.length)];
    return choice ? gear.addTrinket(choice.id) : false;
  }, gameSession);
}
