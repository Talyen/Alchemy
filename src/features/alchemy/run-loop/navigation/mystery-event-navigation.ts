import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { sessionFeedback } from "@/features/alchemy/shared/stores/session-capabilities";
import { type MysteryChoice } from "@/lib/mystery";
import { chooseMysteryCard, chooseMysteryOption } from "./mystery-commands";

export function createMysteryEventNavigation(gameSession: GameSession) {
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
    handleMysteryChoice,
    handleMysteryChooseCard: (arg0: Parameters<typeof chooseMysteryCard>[0]) => chooseMysteryCard(arg0, gameSession),
  };
}
