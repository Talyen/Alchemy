// Memoized active-run snapshot for persistence and autosave.
import { useMemo } from "react";
import type { BattleState } from "@/lib/battle";
import type { BattleCard, CharacterId, DifficultyId } from "@/lib/game-data";
import type { ContentSystemId, LabyrinthMap, LabyrinthModifierKind } from "@/lib/content-systems/types";
import type { TalentXP } from "@/lib/talents";
import type { Destination, Screen } from "../types";
import { createActiveRunData } from "./active-run-data";
import type { LabyrinthNodePosition } from "./types";

type ActiveRunSnapshotInput = {
  characterId: CharacterId;
  runDeck: BattleCard[];
  runGold: number;
  runPlayerHealth: number;
  runMaxHealth: number;
  roomsEncountered: number;
  currentAct: number;
  destinationIndexInAct: number;
  completedDestinations: Destination[];
  runTrinkets: string[];
  encounteredRunEnemyIds: string[];
  selectedDifficulty: DifficultyId | null;
  contentSystemType: ContentSystemId;
  labyrinthMap: LabyrinthMap;
  hasActiveBattle: boolean;
  battleState: BattleState;
  labyrinthPendingNode: LabyrinthNodePosition | null;
  activeLabyrinthModifiers: LabyrinthModifierKind[];
  activeLabyrinthRewardModifiers: LabyrinthModifierKind[];
  runTalentXP: TalentXP;
  currentScreen: Screen;
  destinationChoices: Destination[];
};

export function useActiveRunSnapshot(input: ActiveRunSnapshotInput) {
  // Destructure so useMemo deps are field-level, not `input` — callers pass a new object each render.
  const {
    characterId,
    runDeck,
    runGold,
    runPlayerHealth,
    runMaxHealth,
    roomsEncountered,
    currentAct,
    destinationIndexInAct,
    completedDestinations,
    runTrinkets,
    encounteredRunEnemyIds,
    selectedDifficulty,
    contentSystemType,
    labyrinthMap,
    hasActiveBattle,
    battleState,
    labyrinthPendingNode,
    activeLabyrinthModifiers,
    activeLabyrinthRewardModifiers,
    runTalentXP,
    currentScreen,
    destinationChoices,
  } = input;

  return useMemo(
    () =>
      createActiveRunData({
        characterId,
        runDeck,
        runGold,
        runPlayerHealth,
        runMaxHealth,
        roomsEncountered,
        currentAct,
        destinationIndexInAct,
        completedDestinations,
        runTrinkets,
        encounteredRunEnemyIds,
        selectedDifficulty,
        contentSystemType,
        labyrinthMap,
        hasActiveBattle,
        battleState,
        labyrinthPendingNode,
        activeLabyrinthModifiers,
        activeLabyrinthRewardModifiers,
        runTalentXP,
        currentScreen,
        destinationChoices,
      }),
    [
      characterId,
      runDeck,
      runGold,
      runPlayerHealth,
      runMaxHealth,
      roomsEncountered,
      currentAct,
      destinationIndexInAct,
      completedDestinations,
      runTrinkets,
      encounteredRunEnemyIds,
      selectedDifficulty,
      contentSystemType,
      labyrinthMap,
      hasActiveBattle,
      battleState,
      labyrinthPendingNode,
      activeLabyrinthModifiers,
      activeLabyrinthRewardModifiers,
      runTalentXP,
      currentScreen,
      destinationChoices,
    ],
  );
}
