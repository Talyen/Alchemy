import { defaultGameSession } from "@/features/alchemy/shared/stores/default-game-session";
import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { sessionFeedback } from "@/features/alchemy/shared/stores/session-capabilities";
import { type MysteryChoice } from "@/lib/mystery";
import { ROUTE_SCREENS, type Screen } from "@/lib/routing";
import { beginMysteryVisit, chooseMysteryCard, chooseMysteryOption } from "./mystery-commands";

export function createMysteryEventNavigation(
  {
    navigateTo,
  }: {
    navigateTo: (nextScreen: Screen, prepareNavigation?: () => void) => void;
  },
  gameSession: GameSession = defaultGameSession,
) {
  function beginMysteryEvent(prepareNavigation?: () => void) {
    beginMysteryVisit(gameSession);
    navigateTo(ROUTE_SCREENS.MYSTERY, prepareNavigation);
    sessionFeedback(gameSession).playUISound("musicBoxMystery");
  }
  function handleMysteryChoice(choice: MysteryChoice) {
    for (const sound of chooseMysteryOption(choice, gameSession)) {
      if (sound === "gain") sessionFeedback(gameSession).playGoldGain();
      else sessionFeedback(gameSession).playGoldSpend();
    }
  }
  return {
    beginMysteryEvent,
    handleMysteryChoice,
    handleMysteryChooseCard: (arg0: Parameters<typeof chooseMysteryCard>[0]) => chooseMysteryCard(arg0, gameSession),
  };
}
