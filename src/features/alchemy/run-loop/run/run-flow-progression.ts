import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { clearBattlePresentationUi } from "@/features/alchemy/shared/stores/run-lifecycle";
import { readActiveRun, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";
import { ROUTE_SCREENS } from "@/lib/routing";
import { createProgressionCommands } from "./progression-commands";
import type { CompleteRunVictory, RunFlowHandlerDeps } from "./run-flow";

export function createProgressionHandlers(
  deps: RunFlowHandlerDeps,
  completeRunVictory: CompleteRunVictory,
  gameSession: GameSession,
) {
  const commands = createProgressionCommands(deps.getAvailableDestinations, gameSession);
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
    clearBattlePresentationUi(gameSession);
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
    const activity = readRunSession(gameSession).activity.kind;
    if (
      ![
        "campfire",
        "transmutation",
        "shop",
        "alchemist",
        "trinket-shop",
        "equipment-shop",
        "mystery",
        "corruption",
      ].includes(activity)
    )
      return;
    const labyrinth = readActiveRun(gameSession).contentSystemType === CONTENT_SYSTEMS.LABYRINTH;
    deps.actions.navigateTo(labyrinth ? ROUTE_SCREENS.LABYRINTH_MAP : ROUTE_SCREENS.DESTINATION, () => {
      commands.completeDestination();
      clearBattlePresentationUi(gameSession);
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
