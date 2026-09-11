import type { ShopKind } from "@/features/alchemy/run-loop/shop/shop-action-types";
import type { WildwoodModifierId } from "@/lib/content-systems/wildwood/gauntlet";
import type { BattleCard, DifficultyModifier } from "@/lib/game-data";
import type { Screen, ScreenTransitionOptions } from "@/lib/routing";

interface BattleLauncherDeps {
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
  screen: Screen;
  navigateTo: (nextScreen: Screen, prepareNavigation?: () => void) => void;
  transition: (nextScreen: Screen, options?: ScreenTransitionOptions) => void;
  cancelPending: () => void;
  battle: BattleLauncherDeps;
  initializeShop: (kind: ShopKind) => void;
  labyrinthClearNode: () => void;
}
