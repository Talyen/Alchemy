import type { BattleCard, CharacterId, DifficultyId, DifficultyModifier } from "@/lib/game-data";
import type { EncounterRewardTraitId } from "@/lib/content-systems/encounter-traits";
import type { ScreenTransitionOptions } from "@/features/alchemy/shell/use-screen-transitions";
import type { RewardState } from "@/lib/active-run-session";
import type { DestinationOptionsInput } from "@/features/alchemy/shared/run-flow/destination-flow";
import type { VictoryRewardsResult } from "../navigation/victory-flow";
import {
  readRunSessionStore,
  type RunStateController,
  type TalentStateController,
} from "../../shared/stores/run-session-facade";
import { CONSTANTS, type Destination, type Screen } from "../../shared/types";

export interface RunFlowHandlerDeps {
  run: RunStateController;
  talents: TalentStateController;
  navigateTo: (nextScreen: Screen, onRenderedScreenCommit?: () => void) => void;
  transition: (nextScreen: Screen, options?: ScreenTransitionOptions) => void;
  onLabyrinthFailNode: () => void;
  onLabyrinthClearNode: () => void;
  onInitShop: () => void;
  onInitAlchemist: () => void;
  onInitTrinketShop: () => void;
  onInitEquipmentShop: () => void;
  onStartBattle: (deck?: BattleCard[], gold?: number, enemyType?: "normal" | "elite") => void;
  onStartBossBattle: () => void;
  onStartBossById: (bossId: string, modifiers?: DifficultyModifier[]) => boolean;
  onMarkDifficultyCompleted: (characterId: CharacterId, difficultyId: DifficultyId) => void;
  onCommitWildwoodVictory: (result: VictoryRewardsResult) => void;
  contentNav: {
    createInitialDestinations: (options?: DestinationOptionsInput) => RewardState;
  };
  getAvailableDestinations: (options?: {
    currentHealth?: number;
    currentGold?: number;
    destinationIndexInAct?: number;
    maxHealth?: number;
  }) => Destination[];
  beginMysteryEvent: () => void;
  clearMysteryCardChoices: () => void;
  onWildwoodRewardComplete: () => void;
}

export function getActiveRewardTraits(
  contentSystemType: RunStateController["contentSystemType"],
): EncounterRewardTraitId[] {
  const session = readRunSessionStore();
  if (contentSystemType === CONSTANTS.CONTENT_SYSTEMS.WILDWOOD) {
    return session.wildwoodDraft?.currentRewardTraitIds ?? [];
  }
  return session.activeLabyrinthRewardModifiers as EncounterRewardTraitId[];
}
