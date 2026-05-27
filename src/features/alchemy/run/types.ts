// Persisted run-state contracts shared by controllers and save migration code.
// Depends only on game-data, battle, and content-system type shapes, not React hooks.
import type { BattleState } from "@/lib/battle";
import type { BattleCard, CharacterId, DifficultyId } from "@/lib/game-data";
import type { TalentXP } from "@/lib/talents";
import type { Screen } from "@/features/alchemy/types";

import type { ContentSystemId, LabyrinthMap, LabyrinthModifierKind } from "@/lib/content-systems/types";

export type LabyrinthNodePosition = { row: number; col: number };

type ActiveCombatData = {
  battleState: BattleState;
  activeLabyrinthModifiers: LabyrinthModifierKind[];
  activeLabyrinthRewardModifiers: LabyrinthModifierKind[];
};

export type ActiveRunData = {
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
  labyrinthPendingNode: LabyrinthNodePosition | null;
  activeCombat: ActiveCombatData | null;
  runTalentXP: TalentXP;
  currentScreen: Screen | null;
  destinationChoices: string[];
};

// Shared run-navigation types used across hooks and content-system helpers.
export type DestinationOptionsInput = {
  currentHealth?: number;
  currentGold?: number;
  destinationIndexInAct?: number;
  maxHealth?: number;
};
