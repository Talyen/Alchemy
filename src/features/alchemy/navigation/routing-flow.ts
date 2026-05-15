// Destination-to-screen dispatch for run navigation.
// Keeps route labels and destination side effects out of the main run hook body.
import { DESTINATIONS, type Destination, type Screen } from "../types";

export type DestinationRouteHandlers = {
  navigateTo: (nextScreen: Screen) => void;
  beginMysteryEvent: () => void;
  resetCorruption: () => void;
  startShop: () => void;
  startAlchemist: () => void;
  startBattle: (enemyType: "normal" | "elite") => void;
  startBossBattle: () => void;
};

export function routeDestinationChoice(destination: Destination, handlers: DestinationRouteHandlers) {
  if (destination === DESTINATIONS.CAMPFIRE) handlers.navigateTo("campfire");
  else if (destination === DESTINATIONS.MERCHANT_SHOP) {
    handlers.startShop();
    handlers.navigateTo("shop");
  } else if (destination === DESTINATIONS.ALCHEMIST_SHOP) {
    handlers.startAlchemist();
    handlers.navigateTo("alchemist");
  } else if (destination === DESTINATIONS.MYSTERY) {
    handlers.beginMysteryEvent();
  } else if (destination === DESTINATIONS.CORRUPTION) {
    handlers.resetCorruption();
    handlers.navigateTo("corruption");
  } else if (destination === DESTINATIONS.ELITE_COMBAT) {
    handlers.startBattle("elite");
    handlers.navigateTo("battle");
  } else if (destination === DESTINATIONS.BOSS_COMBAT) {
    handlers.startBossBattle();
    handlers.navigateTo("battle");
  } else {
    handlers.startBattle("normal");
    handlers.navigateTo("battle");
  }
}
