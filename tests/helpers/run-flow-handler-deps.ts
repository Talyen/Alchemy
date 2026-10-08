import type { RunFlowHandlerDeps, RunFlowShellActions } from "@/features/alchemy/run-loop/run/run-flow";
export type MakeFlowHandlerDepsOverrides = Partial<RunFlowHandlerDeps> & Partial<RunFlowShellActions>;

export function makeFlowHandlerDeps(overrides: MakeFlowHandlerDepsOverrides = {}): RunFlowHandlerDeps {
  const {
    getAvailableDestinations = () => [],
    actions: actionsOverride,
    navigateTo = () => {},
    transition = () => {},
    presentBattleStart = () => {},
  } = overrides;
  const actions: RunFlowShellActions = actionsOverride ?? {
    navigateTo,
    transition,
    presentBattleStart,
    clearCardHover: overrides.clearCardHover ?? (() => {}),
  };
  return { actions, getAvailableDestinations };
}
