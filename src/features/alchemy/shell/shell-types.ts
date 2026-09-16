import type { ShopKind } from "@/features/alchemy/run-loop/shop/shop-action-types";
import type { WildwoodModifierId } from "@/lib/content-systems/wildwood/gauntlet";
import type { BattleCard, DifficultyModifier } from "@/lib/game-data";
import type { Screen, ScreenTransitionOptions } from "@/lib/routing";

export interface BattleLauncherDeps {
  onStartBattle: (
    deck?: BattleCard[],
    gold?: number,
    enemyType?: "normal" | "elite",
    modifiers?: DifficultyModifier[],
    enemyId?: string,
  ) => void;
  onStartBossBattle: (modifiers?: DifficultyModifier[], enemyId?: string) => void;
  onStartBossById: (
    bossId: string,
    modifiers?: DifficultyModifier[],
    wildwoodModifierId?: WildwoodModifierId,
  ) => boolean;
}

export interface RunNavigationDeps {
  /** Display-only current screen for React slices; never used for commands. */
  screen: Screen;
  navigateTo: (nextScreen: Screen, prepareNavigation?: () => void) => void;
  transition: (nextScreen: Screen, options?: ScreenTransitionOptions) => void;
  cancelPending: () => void;
  battle: BattleLauncherDeps;
  initializeShop: (kind: ShopKind) => void;
  labyrinthClearNode: () => void;
}

/** Command deps for the framework-free flow engine (no display state). */
export type RunFlowEngineDeps = Omit<RunNavigationDeps, "screen">;
