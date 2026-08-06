// Side-effect intents emitted by run-flow handlers; shell executes them against controllers.
import type { BattleCard, CharacterId, DifficultyId, DifficultyModifier } from "@/lib/game-data";
import type { ScreenTransitionOptions } from "@/features/alchemy/shell/use-screen-transitions";
import type { VictoryRewardsResult } from "../navigation/victory-flow";
import type { Screen } from "../../shared/types";

export type RunFlowIntent =
  | { type: "navigate"; screen: Screen; onRenderedScreenCommit?: () => void }
  | { type: "transition"; screen: Screen; options?: ScreenTransitionOptions }
  | { type: "labyrinth-fail-node" }
  | { type: "labyrinth-clear-node" }
  | { type: "init-shop"; kind: "shop" | "alchemist" | "trinket" | "equipment" }
  | {
      type: "start-battle";
      deck?: BattleCard[];
      gold?: number;
      enemyType?: "normal" | "elite";
    }
  /** Prefer bossId via onStartBossById; fall back to generic boss start when missing or rejected. */
  | { type: "start-boss"; bossId?: string | null; modifiers?: DifficultyModifier[] }
  | { type: "mark-difficulty-completed"; characterId: CharacterId; difficultyId: DifficultyId }
  | { type: "commit-wildwood-victory"; result: VictoryRewardsResult }
  | { type: "begin-mystery-event"; onRenderedScreenCommit?: () => void }
  | { type: "clear-mystery-card-choices" }
  | { type: "wildwood-reward-complete"; onRenderedScreenCommit?: () => void }
  | { type: "select-reward-choice"; id: string };

export type RunFlowDispatch = (intent: RunFlowIntent) => void;
