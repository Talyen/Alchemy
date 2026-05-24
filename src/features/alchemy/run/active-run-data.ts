// Pure helpers for converting live run state into persisted active-run snapshots.
// Depends only on run save contracts and game-data card/character type shapes.
import type { BattleCard, CharacterId, DifficultyId } from "@/lib/game-data";
import type { ContentSystemId, LabyrinthMap, LabyrinthModifierKind } from "@/lib/content-systems/types";
import { isPlayerDefeated, type BattleState } from "@/lib/battle";
import type { TalentXP } from "@/lib/talents";
import type { Screen } from "@/features/alchemy/types";

import type { ActiveRunData } from "./types";
import type { LabyrinthNodePosition } from "./types";

type ActiveRunSource = {
  characterId: CharacterId;
  runDeck: BattleCard[];
  runGold: number;
  runPlayerHealth: number;
  runMaxHealth: number;
  roomsEncountered: number;
  currentAct: number;
  destinationIndexInAct: number;
  completedDestinations: string[];
  runTrinkets: string[];
  encounteredRunEnemyIds: string[];
  selectedDifficulty: DifficultyId | null;
  contentSystemType: ContentSystemId;
  labyrinthMap: LabyrinthMap | null;
  hasActiveBattle: boolean;
  battleState: BattleState;
  labyrinthPendingNode: LabyrinthNodePosition | null;
  activeLabyrinthModifiers: LabyrinthModifierKind[];
  activeLabyrinthRewardModifiers: LabyrinthModifierKind[];
  runTalentXP: TalentXP;
  currentScreen: Screen | null;
  destinationChoices: string[];
};

// Save snapshots intentionally copy persisted run and active-combat fields while leaving UI-only animation state out.
export function createActiveRunData(source: ActiveRunSource): ActiveRunData {
  const activeCombat =
    source.hasActiveBattle && source.battleState.enemyHealth > 0 && !isPlayerDefeated(source.battleState)
      ? {
          battleState: source.battleState,
          activeLabyrinthModifiers: source.contentSystemType === "labyrinth" ? source.activeLabyrinthModifiers : [],
          activeLabyrinthRewardModifiers:
            source.contentSystemType === "labyrinth" ? source.activeLabyrinthRewardModifiers : [],
        }
      : null;

  return {
    characterId: source.characterId,
    runDeck: source.runDeck,
    runGold: source.runGold,
    runPlayerHealth: source.runPlayerHealth,
    runMaxHealth: source.runMaxHealth,
    roomsEncountered: source.roomsEncountered,
    currentAct: source.currentAct,
    destinationIndexInAct: source.destinationIndexInAct,
    completedDestinations: source.completedDestinations,
    runTrinkets: source.runTrinkets,
    encounteredRunEnemyIds: source.encounteredRunEnemyIds,
    selectedDifficulty: source.selectedDifficulty,
    contentSystemType: source.contentSystemType,
    labyrinthMap: source.contentSystemType === "labyrinth" ? source.labyrinthMap : null,
    labyrinthPendingNode: source.contentSystemType === "labyrinth" ? source.labyrinthPendingNode : null,
    activeCombat,
    runTalentXP: source.runTalentXP,
    currentScreen: source.currentScreen,
    destinationChoices: source.destinationChoices,
  };
}
