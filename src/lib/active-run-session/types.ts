// Persisted mid-run save contracts shared by validation, storage, and controllers.
import type { BattleState } from "@/lib/battle";
import type { BattleCard, CharacterId, DifficultyId } from "@/lib/game-data";
import type { ContentSystemId, LabyrinthMap, LabyrinthModifierKind } from "@/lib/content-systems/types";
import type { Screen } from "@/lib/routing";
import type { TalentXP } from "@/lib/talents";

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

export type DestinationOptionsInput = {
  currentHealth?: number;
  currentGold?: number;
  destinationIndexInAct?: number;
  maxHealth?: number;
};
