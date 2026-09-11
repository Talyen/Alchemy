import type { DestinationOptionsInput } from "@/features/alchemy/shared/run-flow/destination-flow";
import type { BattleCard, getDifficultyModifiers } from "@/lib/game-data";
import type { Destination, Screen } from "@/lib/routing";

export interface ContentSystemNavigationDeps {
  navigateTo: (nextScreen: Screen, prepareNavigation?: () => void) => void;
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
