import { defaultGameSession } from "@/features/alchemy/shared/stores/default-game-session";
import type { GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { ENEMY_TYPES } from "@/lib/game-data";
import { DESTINATIONS, ROUTE_SCREENS, type Destination } from "@/lib/routing";
import { initializeAlchemyVisit } from "../navigation/alchemy-commands";
import type { RunFlowShellActions } from "./run-flow";

export type DestinationRouteDeps = Pick<
  RunFlowShellActions,
  "navigateTo" | "beginMysteryEvent" | "initializeShop" | "startBattle" | "startBoss"
> & { resetCorruption: () => void };

const DESTINATION_HANDLERS: Record<Destination, (deps: DestinationRouteDeps, gameSession: GameSession) => void> = {
  [DESTINATIONS.CAMPFIRE]: (deps, gameSession) => {
    initializeAlchemyVisit("campfire", gameSession);
    deps.navigateTo(ROUTE_SCREENS.CAMPFIRE);
  },
  [DESTINATIONS.TRANSMUTATION]: (deps, gameSession) => {
    initializeAlchemyVisit("transmutation", gameSession);
    deps.navigateTo(ROUTE_SCREENS.TRANSMUTATION);
  },
  [DESTINATIONS.CARD_SHOP]: (deps) => {
    deps.initializeShop("merchant");
    deps.navigateTo(ROUTE_SCREENS.SHOP);
  },
  [DESTINATIONS.ALCHEMIST_SHOP]: (deps) => {
    deps.initializeShop("alchemist");
    deps.navigateTo(ROUTE_SCREENS.ALCHEMIST);
  },
  [DESTINATIONS.TRINKET_SHOP]: (deps) => {
    deps.initializeShop("trinket");
    deps.navigateTo(ROUTE_SCREENS.TRINKET_SHOP);
  },
  [DESTINATIONS.GEAR_SHOP]: (deps) => {
    deps.initializeShop("equipment");
    deps.navigateTo(ROUTE_SCREENS.EQUIPMENT_SHOP);
  },
  [DESTINATIONS.MYSTERY]: (deps) => deps.beginMysteryEvent(),
  [DESTINATIONS.CORRUPTION]: (deps) => {
    deps.resetCorruption();
    deps.navigateTo(ROUTE_SCREENS.CORRUPTION);
  },
  [DESTINATIONS.ELITE_COMBAT]: (deps) => {
    deps.startBattle({ enemyType: ENEMY_TYPES.ELITE });
    deps.navigateTo(ROUTE_SCREENS.BATTLE);
  },
  [DESTINATIONS.BOSS_COMBAT]: (deps) => {
    deps.startBoss();
    deps.navigateTo(ROUTE_SCREENS.BATTLE);
  },
  [DESTINATIONS.NORMAL_COMBAT]: (deps) => {
    deps.startBattle({ enemyType: ENEMY_TYPES.NORMAL });
    deps.navigateTo(ROUTE_SCREENS.BATTLE);
  },
};

export function routeDestinationChoice(
  destination: Destination,
  deps: DestinationRouteDeps,
  gameSession: GameSession = defaultGameSession,
) {
  // Unknown destinations fall back to normal combat rather than throwing, so a
  // content gap still yields a playable battle instead of a stuck screen.
  const handler = DESTINATION_HANDLERS[destination] ?? DESTINATION_HANDLERS[DESTINATIONS.NORMAL_COMBAT];
  handler(deps, gameSession);
}
