// Mystery event navigation: begin + choice handlers with screen transition + sound.
import { useCallback } from "react";
import { playUISound } from "@/lib/audio";
import { CONSTANTS, type Screen } from "@/features/alchemy/shared/types";
import { useMysteryFlow } from "@/features/alchemy/run-loop/navigation/use-mystery-flow";

export function useMysteryEventNavigation({
  navigateTo,
  eventsRng,
}: {
  navigateTo: (nextScreen: Screen, onRenderedScreenCommit?: () => void) => void;
  eventsRng: () => number;
}) {
  const mystery = useMysteryFlow(eventsRng);

  const beginMysteryEvent = useCallback(() => {
    mystery.beginMysteryEvent(() => navigateTo(CONSTANTS.SCREENS.MYSTERY));
    playUISound("musicBoxMystery");
  }, [mystery, navigateTo]);

  return {
    beginMysteryEvent,
    handleMysteryChoice: mystery.handleMysteryChoice,
    handleMysteryChooseCard: mystery.handleMysteryChooseCard,
    handleMysteryRemoveCard: mystery.handleMysteryRemoveCard,
    clearCardChoices: mystery.clearCardChoices,
  };
}
