// Test helpers — build run/talent controller shapes from the live run store.
import type {
  BattleRunPort,
  BattleTalentPort,
  ContentNavigationRunPort,
  ContentNavigationTalentPort,
} from "@/features/alchemy/shared/stores/run-port-types";
import { readActiveRun, readRunProfile } from "@/features/alchemy/shared/stores/run-session-read-port";
import { computeTalentEffects } from "@/lib/game-data/talents";

export function makeRunController(): BattleRunPort & ContentNavigationRunPort {
  const run = readActiveRun();
  return {
    characterId: run.characterId,
    selectedDifficulty: run.selectedDifficulty,
    runMaxHealth: run.runMaxHealth,
    contentSystemType: run.contentSystemType,
    roomsEncountered: run.roomsEncountered,
    runBoons: run.runBoons,
    encounteredRunEnemyIds: run.encounteredRunEnemyIds,
    runDeck: run.runDeck,
    gold: readRunProfile().gold,
    lastOfferedDestinations: run.lastOfferedDestinations,
    destinationRoundsSinceOffered: run.destinationRoundsSinceOffered,
  };
}

export function makeTalentController(): BattleTalentPort & ContentNavigationTalentPort {
  const profile = readRunProfile();
  return {
    talentXP: profile.talentXP,
    talentEffects: computeTalentEffects(profile.unlockedTalents),
  };
}
