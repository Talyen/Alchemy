import type { BattleCard, getDifficultyModifiers } from "@/lib/game-data";
import type { Destination, Screen } from "@/lib/routing";
import type { DestinationOptionsInput } from "@/features/alchemy/shared/run-flow/destination-flow";

export interface ContentSystemNavigationDeps {
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
  clearCardHover: () => void;
}
