import type { CollectionTab } from "../types";
import type { GameSession } from "./game-session-types";
import { acceptCommand, dispatchRunSessionCommand, rejectCommand, type RunTransaction } from "./run-session-command";
import {
  bondCompanion as bondCompanionWrite,
  completeResearch as completeResearchWrite,
  constructBuilding as constructBuildingWrite,
  handleCollectionTabChange as handleCollectionTabChangeWrite,
  plantFarm as plantFarmWrite,
  resetHomestead as resetHomesteadWrite,
  setCollectionPage as setCollectionPageWrite,
} from "./run-session-write-port";

function homesteadUpgrade<Id>(mutate: (transaction: RunTransaction, id: Id) => boolean) {
  return (id: Id, gameSession: GameSession): boolean =>
    dispatchRunSessionCommand(
      (transaction) => {
        const ok = mutate(transaction, id);
        return ok ? acceptCommand(ok) : rejectCommand("Homestead upgrade is unavailable", ok);
      },
      undefined,
      gameSession,
    );
}

export const constructBuilding = homesteadUpgrade(constructBuildingWrite);
export const plantFarm = homesteadUpgrade(plantFarmWrite);
export const completeResearch = homesteadUpgrade(completeResearchWrite);
export const bondCompanion = homesteadUpgrade(bondCompanionWrite);

export function resetHomestead(gameSession: GameSession): boolean {
  return dispatchRunSessionCommand(
    (transaction) =>
      resetHomesteadWrite(transaction)
        ? acceptCommand(true)
        : rejectCommand("Homestead has no purchased upgrades", false),
    undefined,
    gameSession,
  );
}

export function selectCollectionTab(tab: CollectionTab, gameSession: GameSession): void {
  dispatchRunSessionCommand(
    (transaction) => acceptCommand(handleCollectionTabChangeWrite(transaction, tab)),
    undefined,
    gameSession,
  );
}

export function setCollectionPage(tab: CollectionTab, page: number, gameSession: GameSession): void {
  dispatchRunSessionCommand(
    (transaction) => acceptCommand(setCollectionPageWrite(transaction, tab, page)),
    undefined,
    gameSession,
  );
}

export {
  equipGear,
  unequipGear,
  equipTrinket,
  unequipTrinket,
  salvageGear,
  applyCurrencyToGear,
  spawnDevGear,
  spawnDevTrinket,
} from "./gear-commands";
