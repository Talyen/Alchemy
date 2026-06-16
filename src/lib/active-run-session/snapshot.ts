// Builds persisted active-run snapshots from live controller/store fields.
import { isPlayerDefeated, type BattleState } from "@/lib/battle";
import type { BattleCard, CharacterId, DifficultyId, TalentXP } from "@/lib/game-data";
import type { ContentSystemId, LabyrinthMap, LabyrinthModifierKind } from "@/lib/content-systems/types";
import type { WildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { Screen } from "@/lib/routing";

import type { ActiveRunData, LabyrinthNodePosition, PersistedPendingReward } from "./types";

export type ActiveRunSnapshotSource = {
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
  wildwoodDraft: WildwoodDraftState | null;
  activeLabyrinthModifiers: LabyrinthModifierKind[];
  activeLabyrinthRewardModifiers: LabyrinthModifierKind[];
  runTalentXP: TalentXP;
  runMaterialsEarned: MaterialInventory;
  currentScreen: Screen | null;
  destinationChoices: string[];
  pendingReward: PersistedPendingReward | null;
};

export function createActiveRunSnapshot(source: ActiveRunSnapshotSource): ActiveRunData {
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
    wildwoodDraft: source.contentSystemType === "wildwood" ? source.wildwoodDraft : null,
    activeCombat,
    runTalentXP: source.runTalentXP,
    runMaterialsEarned: source.runMaterialsEarned,
    currentScreen: source.currentScreen,
    destinationChoices: source.destinationChoices,
    pendingReward: source.pendingReward,
  };
}
