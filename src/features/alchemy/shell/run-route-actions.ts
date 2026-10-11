import {
  brewAtCampfire,
  initializeAlchemyVisit,
  transmuteCard,
  selectTransmutation,
} from "@/features/alchemy/run-loop/navigation/alchemy-commands";
import { restAtCampfire } from "@/features/alchemy/run-loop/run/destination-commands";
import { readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import type { GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import {
  applyCurrencyToGear,
  bondCompanion,
  completeResearch,
  constructBuilding,
  equipGear,
  equipTrinket,
  plantFarm,
  salvageGear,
  selectCollectionTab,
  setCollectionPage,
  spawnDevGear,
  unequipGear,
  unequipTrinket,
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
    initializeAlchemyVisit: (kind: Parameters<typeof initializeAlchemyVisit>[0]) => {
      // An outgoing route can rerun its effect while it fades after navigation.
      if (readRunSession(gameSession).activity.kind === kind) initializeAlchemyVisit(kind, gameSession);
    },
    constructBuilding: (id: Parameters<typeof constructBuilding>[0]) => constructBuilding(id, gameSession),
    plantFarm: (id: Parameters<typeof plantFarm>[0]) => plantFarm(id, gameSession),
    completeResearch: (id: Parameters<typeof completeResearch>[0]) => completeResearch(id, gameSession),
    bondCompanion: (id: Parameters<typeof bondCompanion>[0]) => bondCompanion(id, gameSession),
    selectCollectionTab: (tab: Parameters<typeof selectCollectionTab>[0]) => selectCollectionTab(tab, gameSession),
    setCollectionPage: (tab: Parameters<typeof setCollectionPage>[0], page: number) =>
      setCollectionPage(tab, page, gameSession),
    equipGear: (
      characterId: Parameters<typeof equipGear>[0],
      slot: Parameters<typeof equipGear>[1],
      instance: Parameters<typeof equipGear>[2],
    ) => equipGear(characterId, slot, instance, gameSession),
    unequipGear: (characterId: Parameters<typeof unequipGear>[0], slot: Parameters<typeof unequipGear>[1]) =>
      unequipGear(characterId, slot, gameSession),
    equipTrinket: (characterId: Parameters<typeof equipTrinket>[0], trinketId: Parameters<typeof equipTrinket>[1]) =>
      equipTrinket(characterId, trinketId, gameSession),
    unequipTrinket: (characterId: Parameters<typeof unequipTrinket>[0]) => unequipTrinket(characterId, gameSession),
    salvageGear: (instanceId: Parameters<typeof salvageGear>[0]) => salvageGear(instanceId, gameSession),
    applyCurrencyToGear: (
      currencyId: Parameters<typeof applyCurrencyToGear>[0],
      instanceId: Parameters<typeof applyCurrencyToGear>[1],
      options?: Parameters<typeof applyCurrencyToGear>[2],
    ) => applyCurrencyToGear(currencyId, instanceId, options, gameSession),
    spawnDevGear: (characterId: Parameters<typeof spawnDevGear>[0], options?: Parameters<typeof spawnDevGear>[1]) =>
      spawnDevGear(characterId, options, gameSession),
  });
}
