// Shell side effects that run-flow handlers call directly (navigate, shops, battles, content hooks).
import type { BattleCard, DifficultyModifier } from "@/lib/game-data";
import type { VictoryRewardsResult } from "../navigation/victory-flow";
import type { Screen, ScreenTransitionOptions } from "@/lib/routing";
import type { GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import type { ShopKind } from "@/features/alchemy/run-loop/shop/shop-action-types";

export interface RunFlowShellActions {
  navigateTo: (screen: Screen, onRenderedScreenCommit?: () => void) => void;
  transition: (screen: Screen, options?: ScreenTransitionOptions) => void;
  labyrinthFailNode: () => void;
  labyrinthClearNode: () => void;
  initializeShop: (kind: ShopKind) => void;
  startBattle: (opts?: { deck?: BattleCard[]; gold?: number; enemyType?: "normal" | "elite" }) => void;
  /** Prefer bossId via onStartBossById; fall back to generic boss start when missing or rejected. */
  startBoss: (opts?: { bossId?: string | null; modifiers?: DifficultyModifier[] }) => void;
  /** Update the Wildwood reward handoff in the active command draft. */
  commitWildwoodVictory: (draft: GameplayDraft, result: VictoryRewardsResult) => void;
  beginMysteryEvent: (onRenderedScreenCommit?: () => void) => void;
  clearMysteryCardChoices: () => void;
  wildwoodRewardComplete: (onRenderedScreenCommit?: () => void) => void;
  clearCardHover: () => void;
}
