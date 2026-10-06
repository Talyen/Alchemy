import { brewAtCampfire, transmuteCard } from "@/features/alchemy/run-loop/navigation/alchemy-commands";
import { restAtCampfire } from "@/features/alchemy/run-loop/run/destination-commands";
import type { GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import {
  purchaseTalent,
  resetTalentUnlocks,
  unlockTalentsForDevelopment,
} from "@/features/alchemy/shared/stores/navigation-commands";
import { bindSessionCapabilities } from "@/features/alchemy/shared/stores/session-capabilities";
import { clearRunCardHover, readRunAvailableDestinations } from "./run-destination-wiring";

export function createRunRouteActions(gameSession: GameSession) {
  return bindSessionCapabilities(gameSession, {
    clearCardHover: () => clearRunCardHover(gameSession),
    getAvailableDestinations: (options?: Parameters<typeof readRunAvailableDestinations>[0]) =>
      readRunAvailableDestinations(options, gameSession),
    purchaseTalent: (keyword: Parameters<typeof purchaseTalent>[0], talent: string) =>
      purchaseTalent(keyword, talent, gameSession),
    resetTalentUnlocks: () => resetTalentUnlocks(gameSession),
    unlockTalentsForDevelopment: () => unlockTalentsForDevelopment(gameSession),
    restAtCampfire: () => restAtCampfire(gameSession),
    brewAtCampfire: (operation: Parameters<typeof brewAtCampfire>[0]) => brewAtCampfire(operation, gameSession),
    transmuteCard: (sourceIndex: number, offerIndex: number) => transmuteCard(sourceIndex, offerIndex, gameSession),
  });
}
