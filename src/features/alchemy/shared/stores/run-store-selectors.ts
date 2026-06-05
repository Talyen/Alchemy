// Pure selectors for run-store controller adapters (React hooks and tests).
import type { TalentEffectManifest } from "@/lib/game-data";
import type { RunStore } from "@/features/alchemy/stores/run-store-types";

export function selectRunController(s: RunStore) {
  return {
    characterId: s.characterId,
    runDeck: s.runDeck,
    runGold: s.runGold,
    runPlayerHealth: s.runPlayerHealth,
    runMaxHealth: s.runMaxHealth,
    roomsEncountered: s.roomsEncountered,
    currentAct: s.currentAct,
    destinationIndexInAct: s.destinationIndexInAct,
    completedDestinations: s.completedDestinations,
    runTrinkets: s.runTrinkets,
    encounteredRunEnemyIds: s.encounteredRunEnemyIds,
    selectedDifficulty: s.selectedDifficulty,
    contentSystemType: s.contentSystemType,
    setRunDeck: s.setRunDeck,
    setRunGold: s.setRunGold,
    setRunPlayerHealth: s.setRunPlayerHealth,
    setRunMaxHealth: s.setRunMaxHealth,
    setRoomsEncountered: s.setRoomsEncountered,
    setCurrentAct: s.setCurrentAct,
    setDestinationIndexInAct: s.setDestinationIndexInAct,
    setCompletedDestinations: s.setCompletedDestinations,
    setRunTrinkets: s.setRunTrinkets,
    setEncounteredRunEnemyIds: s.setEncounteredRunEnemyIds,
    setSelectedDifficulty: s.setSelectedDifficulty,
    setContentSystemType: s.setContentSystemType,
    setCharacter: s.setCharacter,
    reset: s.reset,
    addRunGold: s.addRunGold,
    hydrateFromSnapshot: s.hydrateFromSnapshot,
  };
}

export type RunStateController = ReturnType<typeof selectRunController>;

export function selectTalentController(s: RunStore) {
  return {
    talentXP: s.talentXP,
    runTalentXP: s.runTalentXP,
    unlockedTalents: s.unlockedTalents,
    awardCardXP: s.awardCardXP,
    unlockTalent: s.unlockTalent,
    unlockAllTalents: s.unlockAllTalents,
    resetUnlockedTalents: s.resetUnlockedTalents,
    resetRunXP: s.resetRunXP,
    clearPermanentData: s.clearPermanentData,
    awardMysteryXP: s.awardMysteryXP,
    finalizeRunXP: s.finalizeRunXP,
  };
}

export type TalentStateController = ReturnType<typeof selectTalentController> & {
  talentEffects: TalentEffectManifest;
};
