import type { RunFlowHandlerDeps, RunFlowShellActions } from "@/features/alchemy/run-loop/run/run-flow";
export type MakeFlowHandlerDepsOverrides = Partial<RunFlowHandlerDeps> &
  Partial<RunFlowShellActions> & {
    onLabyrinthClearNode?: () => void;
    onInitShop?: () => void;
    onInitAlchemist?: () => void;
    onInitTrinketShop?: () => void;
    onInitEquipmentShop?: () => void;
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
    startBattle = () => {},
    startBoss = () => {},
    beginMysteryEvent = () => {},
    wildwoodRewardComplete,
    onLabyrinthClearNode = () => {},
    onInitShop = () => {},
    onInitAlchemist = () => {},
    onInitTrinketShop = () => {},
    onInitEquipmentShop = () => {},
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
    startBattle,
    startBoss,
    beginMysteryEvent,
    wildwoodRewardComplete: wildwoodRewardComplete ?? onWildwoodRewardComplete,
    clearCardHover: overrides.clearCardHover ?? (() => {}),
  };

  return {
    actions,
    getAvailableDestinations,
  };
}
