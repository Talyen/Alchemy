import type { DestinationOptionsInput } from "@/features/alchemy/shared/run-flow/destination-flow";
import type { BattleStartCommands } from "@/features/alchemy/shared/stores/battle-start-commands";
import type { Destination, Screen } from "@/lib/routing";

export interface ContentSystemNavigationDeps {
  navigateTo: (nextScreen: Screen, prepareNavigation?: () => void) => void;
  resumeTo: (nextScreen: Screen, prepareNavigation?: () => void) => void;
  startBattle: BattleStartCommands["startBattle"];
  getAvailableDestinations: (options?: DestinationOptionsInput) => Destination[];
  onResumeWildwood: () => void;
}
