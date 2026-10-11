import {
  brewAtCampfire,
  transmuteCard,
  selectTransmutation,
} from "@/features/alchemy/run-loop/navigation/alchemy-commands";
import { restAtCampfire } from "@/features/alchemy/run-loop/run/destination-commands";
import type { GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import {
  bondCompanion,
  completeResearch,
  constructBuilding,
  plantFarm,
  selectCollectionTab,
  setCollectionPage,
} from "@/features/alchemy/shared/stores/meta-commands";
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
    selectTransmutation: (selection: Parameters<typeof selectTransmutation>[0]) =>
      selectTransmutation(selection, gameSession),
    transmuteCard: (sourceIndex: number, offerIndex: number) => transmuteCard(sourceIndex, offerIndex, gameSession),
    constructBuilding: (id: Parameters<typeof constructBuilding>[0]) => constructBuilding(id, gameSession),
    plantFarm: (id: Parameters<typeof plantFarm>[0]) => plantFarm(id, gameSession),
    completeResearch: (id: Parameters<typeof completeResearch>[0]) => completeResearch(id, gameSession),
    bondCompanion: (id: Parameters<typeof bondCompanion>[0]) => bondCompanion(id, gameSession),
    selectCollectionTab: (tab: Parameters<typeof selectCollectionTab>[0]) => selectCollectionTab(tab, gameSession),
    setCollectionPage: (tab: Parameters<typeof setCollectionPage>[0], page: number) =>
      setCollectionPage(tab, page, gameSession),
  });
}
