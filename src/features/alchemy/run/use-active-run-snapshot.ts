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
  return useMemo(
    () => createActiveRunData(input),
    [
      input.characterId,
      input.runDeck,
      input.runGold,
      input.runPlayerHealth,
      input.runMaxHealth,
      input.roomsEncountered,
      input.currentAct,
      input.destinationIndexInAct,
      input.completedDestinations,
      input.runTrinkets,
      input.encounteredRunEnemyIds,
      input.selectedDifficulty,
      input.contentSystemType,
      input.labyrinthMap,
      input.hasActiveBattle,
      input.battleState,
      input.labyrinthPendingNode,
      input.activeLabyrinthModifiers,
      input.activeLabyrinthRewardModifiers,
      input.runTalentXP,
      input.currentScreen,
      input.destinationChoices,
    ],
  );
}
