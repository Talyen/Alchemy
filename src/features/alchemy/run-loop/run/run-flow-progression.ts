import { readActiveRun, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { clearBattlePresentationUi } from "@/features/alchemy/shared/stores/run-lifecycle";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";
import { ROUTE_SCREENS } from "@/lib/routing";
import type { CompleteRunVictory, RunFlowHandlerDeps } from "./run-flow";
import { createProgressionCommands } from "./progression-commands";

export function createProgressionHandlers(deps: RunFlowHandlerDeps, completeRunVictory: CompleteRunVictory) {
  const commands = createProgressionCommands(deps.getAvailableDestinations);
  const prepareDestinationScreen = commands.prepareDestinationScreen;
  function prepareNextDestination(index?: number, onCommitted?: () => void) {
    deps.actions.navigateTo(ROUTE_SCREENS.DESTINATION, () => {
      commands.prepareNextDestination(index);
      prepareDestinationScreen();
      onCommitted?.();
    });
  }
  function handleActComplete(prepareNavigation?: () => void) {
    const complete = commands.completeAct();
    clearBattlePresentationUi();
    if (complete) completeRunVictory(prepareNavigation);
    else prepareNextDestination(0, prepareNavigation);
  }
  function returnToCurrentDestination() {
    deps.actions.navigateTo(ROUTE_SCREENS.DESTINATION, () => {
      commands.leaveCorruption();
      prepareDestinationScreen();
    });
  }
  function advanceToNextDestination() {
    const activity = readRunSession().activity.kind;
    if (
      !["campfire", "shop", "alchemist", "trinket-shop", "equipment-shop", "mystery", "corruption"].includes(activity)
    )
      return;
    const labyrinth = readActiveRun().contentSystemType === CONTENT_SYSTEMS.LABYRINTH;
    deps.actions.navigateTo(labyrinth ? ROUTE_SCREENS.LABYRINTH_MAP : ROUTE_SCREENS.DESTINATION, () => {
      commands.completeDestination();
      clearBattlePresentationUi();
      if (labyrinth) deps.actions.labyrinthClearNode();
      else prepareDestinationScreen();
    });
  }
  return {
    prepareNextDestination,
    prepareDestinationScreen,
    handleActComplete,
    advanceToNextDestination,
    returnToCurrentDestination,
  };
}
