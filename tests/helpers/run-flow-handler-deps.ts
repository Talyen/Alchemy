import type { RunFlowHandlerDeps } from "@/features/alchemy/run-loop/run/run-flow-handler-deps";
import type { RunFlowShellActions } from "@/features/alchemy/run-loop/run/run-flow-shell-actions";
import type { BattleCard, DifficultyModifier } from "@/lib/game-data";
import { makeRunController, makeTalentController } from "./run-controller";

export type MakeFlowHandlerDepsOverrides = Partial<RunFlowHandlerDeps> &
  Partial<RunFlowShellActions> & {
    onLabyrinthFailNode?: () => void;
    onLabyrinthClearNode?: () => void;
    onInitShop?: () => void;
    onInitAlchemist?: () => void;
    onInitTrinketShop?: () => void;
    onInitEquipmentShop?: () => void;
    onStartBattle?: (
      deck?: BattleCard[],
      gold?: number,
      enemyType?: "normal" | "elite",
      modifiers?: DifficultyModifier[],
    ) => void;
    onStartBossBattle?: () => void;
    onStartBossById?: (bossId: string, modifiers?: DifficultyModifier[]) => boolean;
    onCommitWildwoodVictory?: RunFlowShellActions["commitWildwoodVictory"];
    onWildwoodRewardComplete?: RunFlowShellActions["wildwoodRewardComplete"];
    onSelectRewardChoice?: RunFlowShellActions["selectRewardChoice"];
    onMarkDifficultyCompleted?: RunFlowShellActions["markDifficultyCompleted"];
  };

/**
 * Builds RunFlowHandlerDeps for tests. Convenience stubs (navigateTo, onInitShop, …)
 * are wired into a default RunFlowShellActions when `actions` is omitted.
 */
export function makeFlowHandlerDeps(overrides: MakeFlowHandlerDepsOverrides = {}): RunFlowHandlerDeps {
  const {
    run = makeRunController(),
    talents = makeTalentController(),
    getAvailableDestinations = () => [],
    actions: actionsOverride,
    navigateTo = () => {},
    transition = () => {},
    labyrinthFailNode,
    labyrinthClearNode,
    initializeShop,
    startBattle,
    startBoss,
    markDifficultyCompleted,
    commitWildwoodVictory,
    beginMysteryEvent = () => {},
    clearMysteryCardChoices = () => {},
    wildwoodRewardComplete,
    selectRewardChoice,
    onLabyrinthFailNode = () => {},
    onLabyrinthClearNode = () => {},
    onInitShop = () => {},
    onInitAlchemist = () => {},
    onInitTrinketShop = () => {},
    onInitEquipmentShop = () => {},
    onStartBattle = () => {},
    onStartBossBattle = () => {},
    onStartBossById = () => true,
    onMarkDifficultyCompleted = () => {},
    onCommitWildwoodVictory = () => {},
    onWildwoodRewardComplete = () => {},
    onSelectRewardChoice,
  } = overrides;

  const actions: RunFlowShellActions = actionsOverride ?? {
    navigateTo,
    transition,
    labyrinthFailNode: labyrinthFailNode ?? onLabyrinthFailNode,
    labyrinthClearNode: labyrinthClearNode ?? onLabyrinthClearNode,
    initializeShop:
      initializeShop ??
      ((kind) => {
        if (kind === "merchant") onInitShop();
        else if (kind === "alchemist") onInitAlchemist();
        else if (kind === "trinket") onInitTrinketShop();
        else onInitEquipmentShop();
      }),
    startBattle:
      startBattle ??
      ((opts) => {
        onStartBattle(opts?.deck, opts?.gold, opts?.enemyType);
      }),
    startBoss:
      startBoss ??
      ((opts) => {
        if (opts?.bossId && onStartBossById(opts.bossId, opts.modifiers)) return;
        onStartBossBattle();
      }),
    markDifficultyCompleted: markDifficultyCompleted ?? onMarkDifficultyCompleted,
    commitWildwoodVictory: commitWildwoodVictory ?? onCommitWildwoodVictory,
    beginMysteryEvent,
    clearMysteryCardChoices,
    wildwoodRewardComplete: wildwoodRewardComplete ?? onWildwoodRewardComplete,
    selectRewardChoice: selectRewardChoice ?? onSelectRewardChoice ?? (() => {}),
    clearCardHover: overrides.clearCardHover ?? (() => {}),
  };

  return {
    run,
    talents,
    actions,
    getAvailableDestinations,
  };
}
