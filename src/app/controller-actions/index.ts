import type { NavigationActions } from "./navigation";
import type { RunStartActions } from "./run-start";
import type { BattleActions } from "./battle";
import type { RunFlowActions } from "./run-flow";
import type { MetaActions } from "./meta";

export type ControllerActions = {
  navigation: NavigationActions;
  runStart: RunStartActions;
  battle: BattleActions;
  runFlow: RunFlowActions;
  meta: MetaActions;
};
