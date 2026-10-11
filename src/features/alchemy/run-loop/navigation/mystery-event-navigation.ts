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
  gameSession: GameSession,
) {
  function beginMysteryEvent(prepareNavigation?: () => void) {
    beginMysteryVisit(gameSession);
    navigateTo(ROUTE_SCREENS.MYSTERY, prepareNavigation);
    sessionFeedback(gameSession).playUISound("musicBoxMystery");
  }
  function handleMysteryChoice(choice: MysteryChoice) {
    const sounds = chooseMysteryOption(choice, gameSession);
    if (sounds === null) return false;
    for (const sound of sounds) {
      if (sound === "gain") sessionFeedback(gameSession).playGoldGain();
      else sessionFeedback(gameSession).playGoldSpend();
    }
    return true;
  }
  return {
    beginMysteryEvent,
    handleMysteryChoice,
    handleMysteryChooseCard: (arg0: Parameters<typeof chooseMysteryCard>[0]) => chooseMysteryCard(arg0, gameSession),
  };
}
