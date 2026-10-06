import type { RunFlowHandlerDeps, RunFlowShellActions } from "@/features/alchemy/run-loop/run/run-flow";
export type MakeFlowHandlerDepsOverrides = Partial<RunFlowHandlerDeps> &
  Partial<RunFlowShellActions> & {
    onLabyrinthClearNode?: () => void;
    onWildwoodRewardComplete?: RunFlowShellActions["wildwoodRewardComplete"];
  };

export function makeFlowHandlerDeps(overrides: MakeFlowHandlerDepsOverrides = {}): RunFlowHandlerDeps {
  const {
    getAvailableDestinations = () => [],
    actions: actionsOverride,
    navigateTo = () => {},
    transition = () => {},
    presentBattleStart = () => {},
    labyrinthClearNode,
    wildwoodRewardComplete,
    onLabyrinthClearNode = () => {},
    onWildwoodRewardComplete = () => {},
  } = overrides;
  const actions: RunFlowShellActions = actionsOverride ?? {
    navigateTo,
    transition,
    presentBattleStart,
    labyrinthClearNode: labyrinthClearNode ?? onLabyrinthClearNode,
    wildwoodRewardComplete: wildwoodRewardComplete ?? onWildwoodRewardComplete,
    clearCardHover: overrides.clearCardHover ?? (() => {}),
  };
  return { actions, getAvailableDestinations };
}
