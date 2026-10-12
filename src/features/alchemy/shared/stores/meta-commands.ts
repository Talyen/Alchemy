import type { BuildingId, FarmId, ResearchId } from "@/lib/homestead/types";
import { trinketLibrary, type CharacterId, type CompanionId } from "@/lib/game-data";
import type { CraftingCurrencyId, GearInstance, GearSlot } from "@/lib/gear";
import { generateDevRandomGearInstance } from "@/lib/gear";
import type { CollectionTab } from "../types";
import type { GameSession } from "./game-session-types";
import { dispatchGameplayCommand } from "./gameplay-command";
import { dispatchGearMutationWithRunHealthSync, dispatchGearSalvageWithMaterialGrant } from "./gear-session-command";
import type { GearDraftView } from "./gear-store-types";
import { flushSaveAfterGearMutation } from "./run-lifecycle";
import { acceptCommand, rejectCommand, type SynchronousResult } from "./run-session-command";
import { isAlchemyDevBuild } from "../utils";
import {
  bondCompanion as bondCompanionWrite,
  completeResearch as completeResearchWrite,
  constructBuilding as constructBuildingWrite,
  plantFarm as plantFarmWrite,
} from "./write/run-homestead";
import {
  handleCollectionTabChange as handleCollectionTabChangeWrite,
  setCollectionPage as setCollectionPageWrite,
} from "./write/run-meta";

export function constructBuilding(id: BuildingId, gameSession: GameSession): boolean {
  return dispatchGameplayCommand(
    (draft) => {
      const ok = constructBuildingWrite(draft, id);
      return ok ? acceptCommand(ok) : rejectCommand("Homestead upgrade is unavailable", ok);
    },
    undefined,
    gameSession,
  );
}

export function plantFarm(id: FarmId, gameSession: GameSession): boolean {
  return dispatchGameplayCommand(
    (draft) => {
      const ok = plantFarmWrite(draft, id);
      return ok ? acceptCommand(ok) : rejectCommand("Homestead upgrade is unavailable", ok);
    },
    undefined,
    gameSession,
  );
}

export function completeResearch(id: ResearchId, gameSession: GameSession): boolean {
  return dispatchGameplayCommand(
    (draft) => {
      const ok = completeResearchWrite(draft, id);
      return ok ? acceptCommand(ok) : rejectCommand("Homestead upgrade is unavailable", ok);
    },
    undefined,
    gameSession,
  );
}

export function bondCompanion(id: CompanionId, gameSession: GameSession): boolean {
  return dispatchGameplayCommand(
    (draft) => {
      const ok = bondCompanionWrite(draft, id);
      return ok ? acceptCommand(ok) : rejectCommand("Homestead upgrade is unavailable", ok);
    },
    undefined,
    gameSession,
  );
}

export function selectCollectionTab(tab: CollectionTab, gameSession: GameSession): void {
  dispatchGameplayCommand((draft) => acceptCommand(handleCollectionTabChangeWrite(draft, tab)), undefined, gameSession);
}

export function setCollectionPage(tab: CollectionTab, page: number, gameSession: GameSession): void {
  dispatchGameplayCommand((draft) => acceptCommand(setCollectionPageWrite(draft, tab, page)), undefined, gameSession);
}

export function mutateGearWithFlush<T>(
  flush: () => void,
  mutate: (state: GearDraftView) => T & SynchronousResult<T>,
  gameSession: GameSession,
): T {
  const result = dispatchGearMutationWithRunHealthSync<T>({ mutate }, gameSession);
  if (result) flush();
  return result;
}

export function salvageGearWithFlush(flush: () => void, instanceId: string, gameSession: GameSession): boolean {
  const result = dispatchGearSalvageWithMaterialGrant((state) => state.salvage(instanceId), gameSession);
  if (result) flush();
  return Boolean(result);
}

export function equipGear(
  characterId: CharacterId,
  slot: GearSlot,
  instance: GearInstance,
  gameSession: GameSession,
): boolean {
  return mutateGearWithFlush(
    () => flushSaveAfterGearMutation(gameSession),
    (state) => state.equip(characterId, slot, instance),
    gameSession,
  );
}

export function unequipGear(characterId: CharacterId, slot: GearSlot, gameSession: GameSession): void {
  mutateGearWithFlush(
    () => flushSaveAfterGearMutation(gameSession),
    (state) => state.unequip(characterId, slot),
    gameSession,
  );
}

export function equipTrinket(characterId: CharacterId, trinketId: string, gameSession: GameSession): void {
  mutateGearWithFlush(
    () => flushSaveAfterGearMutation(gameSession),
    (state) => state.equipTrinket(characterId, trinketId),
    gameSession,
  );
}

export function unequipTrinket(characterId: CharacterId, gameSession: GameSession): void {
  mutateGearWithFlush(
    () => flushSaveAfterGearMutation(gameSession),
    (state) => state.unequipTrinket(characterId),
    gameSession,
  );
}

export function salvageGear(instanceId: string, gameSession: GameSession): boolean {
  return salvageGearWithFlush(() => flushSaveAfterGearMutation(gameSession), instanceId, gameSession);
}

export function applyCurrencyToGear(
  currencyId: CraftingCurrencyId,
  instanceId: string,
  options: { rng?: () => number } | undefined,
  gameSession: GameSession,
): boolean {
  const rng = options?.rng ?? Math.random;
  return mutateGearWithFlush(
    () => flushSaveAfterGearMutation(gameSession),
    (state) => state.applyCurrency(currencyId, instanceId, { rng }),
    gameSession,
  );
}

export function spawnDevGear(
  characterId: CharacterId,
  options: { rng?: () => number } | undefined,
  gameSession: GameSession,
): void {
  if (!isAlchemyDevBuild()) return;
  const rng = options?.rng ?? Math.random;
  dispatchGearMutationWithRunHealthSync<void>(
    {
      mutate: (state) => {
        state.addInstance(generateDevRandomGearInstance(rng), characterId);
      },
    },
    gameSession,
  );
  flushSaveAfterGearMutation(gameSession);
}

export function spawnDevTrinket(options: { rng?: () => number } | undefined, gameSession: GameSession): void {
  if (!isAlchemyDevBuild()) return;
  const rng = options?.rng ?? Math.random;
  dispatchGearMutationWithRunHealthSync<void>(
    {
      mutate: (state) => {
        const owned = new Set(state.ownedTrinketIds);
        const available = trinketLibrary.filter((entry) => !owned.has(entry.id));
        if (available.length === 0) return;
        const choice = available[Math.floor(rng() * available.length)];
        if (choice) {
          state.addTrinket(choice.id);
        }
      },
    },
    gameSession,
  );
  flushSaveAfterGearMutation(gameSession);
}
