import type { RunFlowHandlerDeps, RunFlowShellActions } from "@/features/alchemy/run-loop/run/run-flow";
import type { BattleCard, DifficultyModifier } from "@/lib/game-data";
export type MakeFlowHandlerDepsOverrides = Partial<RunFlowHandlerDeps> &
  Partial<RunFlowShellActions> & {
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
    onWildwoodRewardComplete?: RunFlowShellActions["wildwoodRewardComplete"];
  };

export function makeFlowHandlerDeps(overrides: MakeFlowHandlerDepsOverrides = {}): RunFlowHandlerDeps {
  const {
    getAvailableDestinations = () => [],
    actions: actionsOverride,
    navigateTo = () => {},
    transition = () => {},
    labyrinthClearNode,
    initializeShop,
    startBattle,
    startBoss,
    beginMysteryEvent = () => {},
    wildwoodRewardComplete,
    onLabyrinthClearNode = () => {},
    onInitShop = () => {},
    onInitAlchemist = () => {},
    onInitTrinketShop = () => {},
    onInitEquipmentShop = () => {},
    onStartBattle = () => {},
    onStartBossBattle = () => {},
    onStartBossById = () => true,
    onWildwoodRewardComplete = () => {},
  } = overrides;

  const actions: RunFlowShellActions = actionsOverride ?? {
    navigateTo,
    transition,
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
    beginMysteryEvent,
    wildwoodRewardComplete: wildwoodRewardComplete ?? onWildwoodRewardComplete,
    clearCardHover: overrides.clearCardHover ?? (() => {}),
  };

  return {
    actions,
    getAvailableDestinations,
  };
}
