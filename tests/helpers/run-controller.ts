// Test helpers — build run/talent controller shapes from the live run store.
import { getRunDomainStore } from "./gameplay-store-test";
import type {
  BattleRunPort,
  BattleTalentPort,
  ContentNavigationRunPort,
  ContentNavigationTalentPort,
} from "@/features/alchemy/shared/stores/run-port-types";
import { computeTalentEffects } from "@/lib/game-data/talents";
import { getRunProgressStoreView } from "./run-domain-store-test";

export function makeRunController(): BattleRunPort & ContentNavigationRunPort {
  const state = getRunDomainStore();
  return {
    characterId: state.activeRun.characterId,
    selectedDifficulty: state.activeRun.selectedDifficulty,
    runMaxHealth: state.activeRun.runMaxHealth,
    contentSystemType: state.activeRun.contentSystemType,
    roomsEncountered: state.activeRun.roomsEncountered,
    runBoons: state.activeRun.runBoons,
    encounteredRunEnemyIds: state.activeRun.encounteredRunEnemyIds,
    runDeck: state.activeRun.runDeck,
    gold: getRunProgressStoreView().gold,
    lastOfferedDestinations: state.activeRun.lastOfferedDestinations,
    destinationRoundsSinceOffered: state.activeRun.destinationRoundsSinceOffered,
  };
}

export function makeTalentController(): BattleTalentPort & ContentNavigationTalentPort {
  const base = getRunProgressStoreView();
  return {
    talentXP: base.talentXP,
    talentEffects: computeTalentEffects(base.unlockedTalents),
  };
}
