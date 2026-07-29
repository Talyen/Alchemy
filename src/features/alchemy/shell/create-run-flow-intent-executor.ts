// Executes RunFlowIntent against shell-owned navigation / battle / shop / content controllers.
import type { BattleCard, CharacterId, DifficultyId, DifficultyModifier } from "@/lib/game-data";
import type { ScreenTransitionOptions } from "./use-screen-transitions";
import type { VictoryRewardsResult } from "@/features/alchemy/run-loop/navigation/victory-flow";
import type { RunFlowDispatch, RunFlowIntent } from "@/features/alchemy/run-loop/run/run-flow-intents";
import type { Screen } from "@/features/alchemy/shared/types";

export interface RunFlowIntentExecutorDeps {
  navigateTo: (nextScreen: Screen, onRenderedScreenCommit?: () => void) => void;
  transition: (nextScreen: Screen, options?: ScreenTransitionOptions) => void;
  onLabyrinthFailNode: () => void;
  onLabyrinthClearNode: () => void;
  onInitShop: () => void;
  onInitAlchemist: () => void;
  onInitTrinketShop: () => void;
  onInitEquipmentShop: () => void;
  onStartBattle: (deck?: BattleCard[], gold?: number, enemyType?: "normal" | "elite") => void;
  onStartBossBattle: () => void;
  onStartBossById: (bossId: string, modifiers?: DifficultyModifier[]) => boolean;
  onMarkDifficultyCompleted: (characterId: CharacterId, difficultyId: DifficultyId) => void;
  onCommitWildwoodVictory: (result: VictoryRewardsResult) => void;
  beginMysteryEvent: () => void;
  clearMysteryCardChoices: () => void;
  onWildwoodRewardComplete: () => void;
  onSelectRewardChoice?: (id: string) => void;
}

export function createRunFlowIntentExecutor(deps: RunFlowIntentExecutorDeps): RunFlowDispatch {
  return function dispatchRunFlowIntent(intent: RunFlowIntent): void {
    switch (intent.type) {
      case "navigate":
        if (intent.onRenderedScreenCommit) {
          deps.navigateTo(intent.screen, intent.onRenderedScreenCommit);
        } else {
          deps.navigateTo(intent.screen);
        }
        return;
      case "transition":
        deps.transition(intent.screen, intent.options);
        return;
      case "labyrinth-fail-node":
        deps.onLabyrinthFailNode();
        return;
      case "labyrinth-clear-node":
        deps.onLabyrinthClearNode();
        return;
      case "init-shop":
        deps.onInitShop();
        return;
      case "init-alchemist":
        deps.onInitAlchemist();
        return;
      case "init-trinket-shop":
        deps.onInitTrinketShop();
        return;
      case "init-equipment-shop":
        deps.onInitEquipmentShop();
        return;
      case "start-battle":
        deps.onStartBattle(intent.deck, intent.gold, intent.enemyType);
        return;
      case "start-boss":
        if (intent.bossId && deps.onStartBossById(intent.bossId, intent.modifiers)) return;
        deps.onStartBossBattle();
        return;
      case "mark-difficulty-completed":
        deps.onMarkDifficultyCompleted(intent.characterId, intent.difficultyId);
        return;
      case "commit-wildwood-victory":
        deps.onCommitWildwoodVictory(intent.result);
        return;
      case "begin-mystery-event":
        deps.beginMysteryEvent();
        return;
      case "clear-mystery-card-choices":
        deps.clearMysteryCardChoices();
        return;
      case "wildwood-reward-complete":
        deps.onWildwoodRewardComplete();
        return;
      case "select-reward-choice":
        deps.onSelectRewardChoice?.(intent.id);
        return;
      default: {
        const _exhaustive: never = intent;
        void _exhaustive;
      }
    }
  };
}
