import type { ShopKind } from "@/features/alchemy/run-loop/shop/shop-action-types";
import type { BattleStartCommands } from "@/features/alchemy/shared/stores/battle-start-commands";
import type { Screen, ScreenTransitionOptions } from "@/lib/routing";

/** Command deps for the framework-free flow engine (no display state). */
export interface RunFlowEngineDeps {
  navigateTo: (nextScreen: Screen, prepareNavigation?: () => void) => void;
  resumeTo: (nextScreen: Screen, prepareNavigation?: () => void) => void;
  transition: (nextScreen: Screen, options?: ScreenTransitionOptions) => void;
  cancelPending: () => void;
  battle: BattleStartCommands;
  initializeShop: (kind: ShopKind) => void;
  labyrinthClearNode: () => void;
}
