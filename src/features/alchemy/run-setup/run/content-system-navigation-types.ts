import type { RefObject } from "react";
import type { BattleCard, DifficultyId, getDifficultyModifiers } from "@/lib/game-data";
import type { ContentSystemId } from "@/lib/content-systems/types";
import type { Destination, Screen } from "@/features/alchemy/shared/types";
import type { DestinationOptionsInput } from "@/features/alchemy/shared/run-flow/destination-flow";
import type { RunStateController, TalentStateController } from "../../shared/stores/run-session-facade";

export interface ContentSystemNavigationDeps {
  run: RunStateController;
  talents: TalentStateController;
  draftedDeckRef: RefObject<BattleCard[] | null>;
  hasActiveRun: boolean;
  hasActiveBattle: boolean;
  pendingContentSystemType: ContentSystemId | null;
  completedDifficulties: Record<string, DifficultyId[]>;
  navigateTo: (nextScreen: Screen, onRenderedScreenCommit?: () => void) => void;
  returnToBattle: () => void;
  onStartBattle: (
    deck?: BattleCard[],
    gold?: number,
    enemyType?: "normal" | "elite",
    modifiers?: ReturnType<typeof getDifficultyModifiers>,
  ) => void;
  getAvailableDestinations: (options?: DestinationOptionsInput) => Destination[];
  onResumeWildwood: () => void;
  onStartNextWildwoodBoss: () => void;
}
