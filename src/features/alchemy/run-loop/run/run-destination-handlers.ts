// Destination routing helpers and reward selection utilities for run flow.
import type { Dispatch, SetStateAction } from "react";
import type { BattleCard } from "@/lib/game-data";
import type { GearInstance } from "@/lib/gear";
import { useGearStore } from "@/features/alchemy/shared/stores/gear-store";
import { readActiveRunStore } from "@/features/alchemy/shared/stores/run-session-facade";
import type { RewardState } from "../navigation/reward-flow";
import { getRandomPotionCard } from "../navigation/reward-flow";
import { appendCardToRunWithDiscovery, appendTrinketToRunWithDiscovery } from "./deck-mutations";
import { CONSTANTS, type Destination, type Screen } from "../../shared/types";

export interface DestinationRouteHandlers {
  navigateTo: (nextScreen: Screen) => void;
  beginMysteryEvent: () => void;
  resetCorruption: () => void;
  startShop: () => void;
  startAlchemist: () => void;
  startTrinketShop: () => void;
  startEquipmentShop: () => void;
  startBattle: (enemyType: typeof CONSTANTS.ENEMY_TYPES.NORMAL | typeof CONSTANTS.ENEMY_TYPES.ELITE) => void;
  startBossBattle: () => void;
}

const DESTINATION_HANDLERS: Record<Destination, (handlers: DestinationRouteHandlers) => void> = {
  [CONSTANTS.DESTINATIONS.CAMPFIRE]: (handlers) => handlers.navigateTo(CONSTANTS.SCREENS.CAMPFIRE),
  [CONSTANTS.DESTINATIONS.MERCHANT_SHOP]: (handlers) => {
    handlers.startShop();
    handlers.navigateTo(CONSTANTS.SCREENS.SHOP);
  },
  [CONSTANTS.DESTINATIONS.ALCHEMIST_SHOP]: (handlers) => {
    handlers.startAlchemist();
    handlers.navigateTo(CONSTANTS.SCREENS.ALCHEMIST);
  },
  [CONSTANTS.DESTINATIONS.TRINKET_SHOP]: (handlers) => {
    handlers.startTrinketShop();
    handlers.navigateTo(CONSTANTS.SCREENS.TRINKET_SHOP);
  },
  [CONSTANTS.DESTINATIONS.EQUIPMENT_SHOP]: (handlers) => {
    handlers.startEquipmentShop();
    handlers.navigateTo(CONSTANTS.SCREENS.EQUIPMENT_SHOP);
  },
  [CONSTANTS.DESTINATIONS.MYSTERY]: (handlers) => handlers.beginMysteryEvent(),
  [CONSTANTS.DESTINATIONS.CORRUPTION]: (handlers) => {
    handlers.resetCorruption();
    handlers.navigateTo(CONSTANTS.SCREENS.CORRUPTION);
  },
  [CONSTANTS.DESTINATIONS.ELITE_COMBAT]: (handlers) => {
    handlers.startBattle(CONSTANTS.ENEMY_TYPES.ELITE);
    handlers.navigateTo(CONSTANTS.SCREENS.BATTLE);
  },
  [CONSTANTS.DESTINATIONS.BOSS_COMBAT]: (handlers) => {
    handlers.startBossBattle();
    handlers.navigateTo(CONSTANTS.SCREENS.BATTLE);
  },
  [CONSTANTS.DESTINATIONS.NORMAL_COMBAT]: (handlers) => {
    handlers.startBattle(CONSTANTS.ENEMY_TYPES.NORMAL);
    handlers.navigateTo(CONSTANTS.SCREENS.BATTLE);
  },
};

export function routeDestinationChoice(destination: Destination, handlers: DestinationRouteHandlers) {
  const handler = DESTINATION_HANDLERS[destination] ?? DESTINATION_HANDLERS[CONSTANTS.DESTINATIONS.NORMAL_COMBAT];
  handler(handlers);
}

interface RewardSelectionInput {
  choice: BattleCard | { id: string } | GearInstance;
  type: RewardState["rewardType"];
  setRunDeck: Dispatch<SetStateAction<BattleCard[]>>;
  setRunTrinkets: Dispatch<SetStateAction<string[]>>;
}

export function applyRewardSelection({ choice, type, setRunDeck, setRunTrinkets }: RewardSelectionInput) {
  if (type === "card") {
    appendCardToRunWithDiscovery(choice as BattleCard, setRunDeck);
  } else if (type === "trinket") {
    appendTrinketToRunWithDiscovery((choice as { id: string }).id, setRunTrinkets);
  } else if (type === "gear") {
    const characterId = readActiveRunStore().characterId;
    useGearStore.getState().addInstance(choice as GearInstance, characterId);
  }
}

export function applyAlchemistPotion({
  setRunDeck,
  rng = Math.random,
}: {
  setRunDeck: Dispatch<SetStateAction<BattleCard[]>>;
  rng?: () => number;
}) {
  const potion = getRandomPotionCard(rng);
  appendCardToRunWithDiscovery(potion, setRunDeck);
}
