// Executes RunFlowIntent against shell-owned navigation / battle / shop / content controllers.
import type { CharacterId, DifficultyId } from "@/lib/game-data";
import type { ScreenTransitionOptions } from "./use-screen-transitions";
import type { RunFlowDispatch, RunFlowIntent } from "@/features/alchemy/run-loop/run/run-flow-intents";
import type { Screen } from "@/features/alchemy/shared/types";
import type { BattleLauncherDeps, LabyrinthNavOps, MysteryNavOps, ShopNavOps, WildwoodNavOps } from "./shell-types";

export interface RunFlowIntentExecutorDeps {
  navigateTo: (nextScreen: Screen, onRenderedScreenCommit?: () => void) => void;
  transition: (nextScreen: Screen, options?: ScreenTransitionOptions) => void;
  labyrinth?: LabyrinthNavOps;
  shop?: ShopNavOps;
  battle?: BattleLauncherDeps;
  wildwood?: WildwoodNavOps;
  mystery?: MysteryNavOps;
  onMarkDifficultyCompleted: (characterId: CharacterId, difficultyId: DifficultyId) => void;
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
        deps.labyrinth?.onLabyrinthFailNode();
        return;
      case "labyrinth-clear-node":
        deps.labyrinth?.onLabyrinthClearNode();
        return;
      case "init-shop":
        if (intent.kind === "shop") deps.shop?.onInitShop();
        else if (intent.kind === "alchemist") deps.shop?.onInitAlchemist();
        else if (intent.kind === "trinket") deps.shop?.onInitTrinketShop();
        else deps.shop?.onInitEquipmentShop();
        return;
      case "start-battle":
        deps.battle?.onStartBattle(intent.deck, intent.gold, intent.enemyType);
        return;
      case "start-boss":
        if (intent.bossId && deps.battle?.onStartBossById(intent.bossId, intent.modifiers)) return;
        deps.battle?.onStartBossBattle();
        return;
      case "mark-difficulty-completed":
        deps.onMarkDifficultyCompleted(intent.characterId, intent.difficultyId);
        return;
      case "commit-wildwood-victory":
        deps.wildwood?.onCommitWildwoodVictory(intent.result);
        return;
      case "begin-mystery-event":
        deps.mystery?.beginMysteryEvent(intent.onRenderedScreenCommit);
        return;
      case "clear-mystery-card-choices":
        deps.mystery?.clearMysteryCardChoices();
        return;
      case "wildwood-reward-complete":
        deps.wildwood?.onWildwoodRewardComplete(intent.onRenderedScreenCommit);
        return;
      case "select-reward-choice":
        deps.wildwood?.onSelectRewardChoice?.(intent.id);
        return;
      default: {
        const _exhaustive: never = intent;
        void _exhaustive;
      }
    }
  };
}
