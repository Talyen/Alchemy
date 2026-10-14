import type { BattleStartCommands } from "@/features/alchemy/shared/stores/battle-start-commands";
import type { Screen } from "@/lib/routing";

export interface ContentSystemNavigationDeps {
  navigateTo: (nextScreen: Screen, prepareNavigation?: () => void) => void;
  resumeTo: (nextScreen: Screen, prepareNavigation?: () => void) => void;
  presentBattleStart: BattleStartCommands["presentBattleStart"];
  onResumeWildwood: () => void;
}
