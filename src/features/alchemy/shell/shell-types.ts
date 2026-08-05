import type { BattleCard, CharacterId, DifficultyId, DifficultyModifier } from "@/lib/game-data";
import type { WildwoodModifierId } from "@/lib/content-systems/wildwood/gauntlet";
import type { Screen } from "@/features/alchemy/shared/types";
import type { ScreenTransitionOptions } from "./use-screen-transitions";
import type { VictoryRewardsResult } from "@/features/alchemy/run-loop/navigation/victory-flow";

export interface BattleLauncherDeps {
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

export interface ShopNavOps {
  onInitShop: () => void;
  onInitAlchemist: () => void;
  onInitTrinketShop: () => void;
  onInitEquipmentShop: () => void;
}

export interface LabyrinthNavOps {
  onLabyrinthClearNode: () => void;
  onLabyrinthFailNode: () => void;
}

export interface WildwoodNavOps {
  onCommitWildwoodVictory: (result: VictoryRewardsResult) => void;
  onWildwoodRewardComplete: (onRenderedScreenCommit?: () => void) => void;
  onSelectRewardChoice?: (id: string) => void;
}

export interface MysteryNavOps {
  beginMysteryEvent: (onRenderedScreenCommit?: () => void) => void;
  clearMysteryCardChoices: () => void;
}

export interface RunNavigationDeps {
  screen: Screen;
  navigateTo: (nextScreen: Screen, onRenderedScreenCommit?: () => void) => void;
  transition: (nextScreen: Screen, options?: ScreenTransitionOptions) => void;
  cancelPending: () => void;
  onMarkDifficultyCompleted: (characterId: CharacterId, difficultyId: DifficultyId) => void;
  randomSources: {
    rewards: () => number;
    destinations: () => number;
    events: () => number;
    world: () => number;
  };
  battle: BattleLauncherDeps;
  labyrinth: LabyrinthNavOps;
  shop: ShopNavOps;
  wildwood?: WildwoodNavOps;
  mystery?: MysteryNavOps;
}

export type {
  MetaRouteCommands,
  RunSetupRouteCommands,
  RunLoopRouteCommands,
  BattleRouteCommands,
  RunEndRouteCommands,
  AlchemyRouteCommands,
} from "./create-route-commands";
