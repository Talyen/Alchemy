import { playGoldGain, playGoldSpend, playUISound } from "@/lib/audio";
import { type MysteryChoice } from "@/lib/mystery";
import { ROUTE_SCREENS, type Screen } from "@/lib/routing";
import { beginMysteryVisit, chooseMysteryOption, chooseMysteryCard } from "./mystery-commands";

export function createMysteryEventNavigation({
  navigateTo,
}: {
  navigateTo: (nextScreen: Screen, prepareNavigation?: () => void) => void;
}) {
  function beginMysteryEvent(prepareNavigation?: () => void) {
    beginMysteryVisit();
    navigateTo(ROUTE_SCREENS.MYSTERY, prepareNavigation);
    playUISound("musicBoxMystery");
  }
  function handleMysteryChoice(choice: MysteryChoice) {
    for (const sound of chooseMysteryOption(choice)) {
      if (sound === "gain") playGoldGain();
      else playGoldSpend();
    }
  }
  return { beginMysteryEvent, handleMysteryChoice, handleMysteryChooseCard: chooseMysteryCard };
}
