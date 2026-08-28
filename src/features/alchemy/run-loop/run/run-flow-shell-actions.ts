import type { BattleCard, DifficultyModifier } from "@/lib/game-data";
import type { VictoryRewardsResult } from "../navigation/victory-flow";
import type { Screen, ScreenTransitionOptions } from "@/lib/routing";
import type { GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import type { ShopKind } from "@/features/alchemy/run-loop/shop/shop-action-types";

export interface RunFlowShellActions {
  navigateTo: (screen: Screen, onRenderedScreenCommit?: () => void) => void;
  transition: (screen: Screen, options?: ScreenTransitionOptions) => void;
  labyrinthClearNode: () => void;
  initializeShop: (kind: ShopKind) => void;
  startBattle: (opts?: { deck?: BattleCard[]; gold?: number; enemyType?: "normal" | "elite" }) => void;

  startBoss: (opts?: { bossId?: string | null; modifiers?: DifficultyModifier[] }) => void;

  commitWildwoodVictory: (draft: GameplayDraft, result: VictoryRewardsResult) => void;
  beginMysteryEvent: (onRenderedScreenCommit?: () => void) => void;
  wildwoodRewardComplete: (onRenderedScreenCommit?: () => void) => void;
  clearCardHover: () => void;
}
