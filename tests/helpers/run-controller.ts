// Test helpers — build run/talent controller shapes from the live run store.
import { getRunDomainStore } from "./gameplay-store-test";
import type {
  BattleRunPort,
  BattleTalentPort,
  ContentNavigationRunPort,
  ContentNavigationTalentPort,
  RunFlowRunPort,
  RunFlowTalentPort,
} from "@/features/alchemy/shared/stores/run-port-types";
import { computeTalentEffects } from "@/lib/game-data/talents";
import type { KeywordId, TalentXP, UnlockedTalents } from "@/lib/game-data";
import type { Destination } from "@/features/alchemy/shared/types";
import { getRunProgressStoreView } from "./run-domain-store-test";

type TestRunPort = RunFlowRunPort &
  ContentNavigationRunPort &
  BattleRunPort & {
    destinationIndexInAct: number;
    completedDestinations: Destination[];
  };

type TestTalentPort = RunFlowTalentPort &
  ContentNavigationTalentPort &
  BattleTalentPort & {
    runTalentXP: TalentXP;
    unlockedTalents: UnlockedTalents;
    awardMysteryXP: (keywordId: KeywordId, amount: number) => void;
    resetRunXP: () => void;
    unlockTalent: (keywordId: KeywordId, talentId: string) => void;
    resetUnlockedTalents: () => void;
  };

export function makeRunController() {
  const state = getRunDomainStore();
  const port = {
    contentSystemType: state.activeRun.contentSystemType,
    currentAct: state.activeRun.currentAct,
    selectedDifficulty: state.activeRun.selectedDifficulty,
    characterId: state.activeRun.characterId,
    runMaxHealth: state.activeRun.runMaxHealth,
    destinationIndexInAct: state.activeRun.destinationIndexInAct,
    completedDestinations: state.activeRun.completedDestinations,
    runPlayerHealth: state.activeRun.runPlayerHealth,
    runGold: state.activeRun.runGold,
    runDeck: state.activeRun.runDeck,
    runTrinkets: state.activeRun.runTrinkets,
    roomsEncountered: state.activeRun.roomsEncountered,
    encounteredRunEnemyIds: state.activeRun.encounteredRunEnemyIds,
    lastOfferedDestinations: state.activeRun.lastOfferedDestinations,
    destinationRoundsSinceOffered: state.activeRun.destinationRoundsSinceOffered,
    updateRunDeck: state.setRunDeck,
    updateRunPlayerHealth: state.setRunPlayerHealth,
    updateRoomsEncountered: state.setRoomsEncountered,
    updateCurrentAct: state.setCurrentAct,
    updateDestinationIndexInAct: state.setDestinationIndexInAct,
    updateCompletedDestinations: state.setCompletedDestinations,
    updateDestinationOfferState: state.setDestinationOfferState,
    updateRunTrinkets: state.setRunTrinkets,
    updateEncounteredRunEnemyIds: state.setEncounteredRunEnemyIds,
    setSelectedDifficulty: state.setSelectedDifficulty,
    setContentSystemType: state.setContentSystemType,
    setCharacter: state.setCharacter,
    addRunGold: state.addRunGold,
  };
  return port as TestRunPort;
}

export function makeTalentController() {
  const base = getRunProgressStoreView();
  const talentEffects = computeTalentEffects(base.unlockedTalents);
  const port = {
    talentXP: base.talentXP,
    runTalentXP: base.runTalentXP,
    unlockedTalents: base.unlockedTalents,
    talentEffects,
    awardCardXP: base.awardCardXP,
    awardMysteryXP: base.awardMysteryXP,
    resetRunXP: base.resetRunXP,
    unlockTalent: base.unlockTalent,
    resetUnlockedTalents: base.resetUnlockedTalents,
  };
  return port as TestTalentPort;
}
