import type { CollectionTab } from "../types";
import type { GameSession } from "./game-session-types";
import { dispatchGameplayCommand, type GameplayDraft } from "./gameplay-command";
import { acceptCommand, rejectCommand } from "./run-session-command";
import {
  bondCompanion as bondCompanionWrite,
  completeResearch as completeResearchWrite,
  constructBuilding as constructBuildingWrite,
  plantFarm as plantFarmWrite,
  resetHomestead as resetHomesteadWrite,
} from "./write/run-homestead";
import {
  handleCollectionTabChange as handleCollectionTabChangeWrite,
  setCollectionPage as setCollectionPageWrite,
} from "./write/run-meta";

function homesteadUpgrade<Id>(mutate: (draft: GameplayDraft, id: Id) => boolean) {
  return (id: Id, gameSession: GameSession): boolean =>
    dispatchGameplayCommand(
      (draft) => {
        const ok = mutate(draft, id);
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
  return dispatchGameplayCommand(
    (draft) =>
      resetHomesteadWrite(draft) ? acceptCommand(true) : rejectCommand("Homestead has no purchased upgrades", false),
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
