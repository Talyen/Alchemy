import type { RefObject } from "react";
import type { BattleCard, DifficultyId, getDifficultyModifiers } from "@/lib/game-data";
import type { ContentSystemId } from "@/lib/content-systems/types";
import type { Destination, Screen } from "@/features/alchemy/shared/types";
import type { DestinationOptionsInput } from "@/features/alchemy/shared/run-flow/destination-flow";
import type { ContentNavigationRunPort, ContentNavigationTalentPort } from "../../shared/stores/run-port-types";

export interface ContentSystemNavigationDeps {
  run: ContentNavigationRunPort;
  talents: ContentNavigationTalentPort;
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
  destinationRng: () => number;
  worldRng: () => number;
  clearCardHover: () => void;
}
