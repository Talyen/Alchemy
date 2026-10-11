import type { BuildingId, FarmId, ResearchId } from "@/lib/homestead/types";
import type { CompanionId } from "@/lib/game-data";
import type { CollectionTab } from "../types";
import type { GameSession } from "./game-session-types";
import { dispatchGameplayCommand } from "./gameplay-command";
import { acceptCommand, rejectCommand } from "./run-session-command";
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
