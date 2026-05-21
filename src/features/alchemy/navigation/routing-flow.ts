// Destination-to-screen dispatch for run navigation.
// Depends on: CONSTANTS, Destination, Screen from types.
// Depended on by: useRunNavigation for mapping selected destinations to game screens and state transitions.
import { CONSTANTS, type Destination, type Screen } from "../types";

export type DestinationRouteHandlers = {
  navigateTo: (nextScreen: Screen) => void;
  beginMysteryEvent: () => void;
  resetCorruption: () => void;
  startShop: () => void;
  startAlchemist: () => void;
  startBattle: (enemyType: typeof CONSTANTS.ENEMY_TYPES.NORMAL | typeof CONSTANTS.ENEMY_TYPES.ELITE) => void;
  startBossBattle: () => void;
};

export function routeDestinationChoice(destination: Destination, handlers: DestinationRouteHandlers) {
  if (destination === CONSTANTS.DESTINATIONS.CAMPFIRE) handlers.navigateTo(CONSTANTS.SCREENS.CAMPFIRE);
  else if (destination === CONSTANTS.DESTINATIONS.MERCHANT_SHOP) {
    handlers.startShop();
    handlers.navigateTo(CONSTANTS.SCREENS.SHOP);
  } else if (destination === CONSTANTS.DESTINATIONS.ALCHEMIST_SHOP) {
    handlers.startAlchemist();
    handlers.navigateTo(CONSTANTS.SCREENS.ALCHEMIST);
  } else if (destination === CONSTANTS.DESTINATIONS.MYSTERY) {
    handlers.beginMysteryEvent();
  } else if (destination === CONSTANTS.DESTINATIONS.CORRUPTION) {
    handlers.resetCorruption();
    handlers.navigateTo(CONSTANTS.SCREENS.CORRUPTION);
  } else if (destination === CONSTANTS.DESTINATIONS.ELITE_COMBAT) {
    handlers.startBattle(CONSTANTS.ENEMY_TYPES.ELITE);
    handlers.navigateTo(CONSTANTS.SCREENS.BATTLE);
  } else if (destination === CONSTANTS.DESTINATIONS.BOSS_COMBAT) {
    handlers.startBossBattle();
    handlers.navigateTo(CONSTANTS.SCREENS.BATTLE);
  } else {
    handlers.startBattle(CONSTANTS.ENEMY_TYPES.NORMAL);
    handlers.navigateTo(CONSTANTS.SCREENS.BATTLE);
  }
}
