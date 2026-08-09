import type { BattleCard, CharacterId, DifficultyId, DifficultyModifier } from "@/lib/game-data";
import type { WildwoodModifierId } from "@/lib/content-systems/wildwood/gauntlet";
import type { Screen } from "@/features/alchemy/shared/types";
import type { ScreenTransitionOptions } from "./use-screen-transitions";
import type { ShopKind } from "@/features/alchemy/run-loop/shop/shop-action-types";

interface BattleLauncherDeps {
  onStartBattle: (
    deck?: BattleCard[],
    gold?: number,
    enemyType?: "normal" | "elite",
    modifiers?: DifficultyModifier[],
  ) => void;
  onStartBossBattle: () => void;
  onStartBossById: (
    bossId: string,
    modifiers?: DifficultyModifier[],
    wildwoodModifierId?: WildwoodModifierId,
  ) => boolean;
}

export interface RunNavigationDeps {
  screen: Screen;
  navigateTo: (nextScreen: Screen, onRenderedScreenCommit?: () => void) => void;
  transition: (nextScreen: Screen, options?: ScreenTransitionOptions) => void;
  cancelPending: () => void;
  onMarkDifficultyCompleted: (characterId: CharacterId, difficultyId: DifficultyId) => void;
  battle: BattleLauncherDeps;
  initializeShop: (kind: ShopKind) => void;
  labyrinthClearNode: () => void;
  labyrinthFailNode: () => void;
}
