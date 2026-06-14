// Destination routing helpers and reward selection utilities for run flow.
import type { Dispatch, SetStateAction } from "react";
import type { BattleCard } from "@/lib/game-data";
import type { GearDefinition } from "@/lib/gear";
import { useGearStore } from "@/features/alchemy/shared/stores/gear-store";
import type { RewardState } from "../navigation/reward-flow";
import { getRandomPotionCard } from "../navigation/reward-flow";
import { appendCardToRunWithDiscovery, appendBoonToRunWithDiscovery } from "./deck-mutations";
import { CONSTANTS, type Destination, type Screen } from "../../shared/types";
import { createInstanceId } from "@/lib/utils";

export type DestinationRouteHandlers = {
  navigateTo: (nextScreen: Screen) => void;
  beginMysteryEvent: () => void;
  resetCorruption: () => void;
  startShop: () => void;
  startAlchemist: () => void;
  startBattle: (enemyType: typeof CONSTANTS.ENEMY_TYPES.NORMAL | typeof CONSTANTS.ENEMY_TYPES.ELITE) => void;
  startBossBattle: () => void;
};

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

type RewardSelectionInput = {
  choice: BattleCard | { id: string } | GearDefinition;
  type: RewardState["rewardType"];
  setRunDeck: Dispatch<SetStateAction<BattleCard[]>>;
  setRunBoons: Dispatch<SetStateAction<string[]>>;
};

export function applyRewardSelection({ choice, type, setRunDeck, setRunBoons }: RewardSelectionInput) {
  const selectedId = choice.id;
  if (type === "card") {
    appendCardToRunWithDiscovery(choice as BattleCard, setRunDeck);
  } else if (type === "boon") {
    appendBoonToRunWithDiscovery(selectedId, setRunBoons);
  } else {
    const instanceId = createInstanceId();
    useGearStore
      .getState()
      .addInstance({ instanceId, definitionId: selectedId as GearDefinition["id"], modifiers: [] });
  }
}

export function applyAlchemistPotion({ setRunDeck }: { setRunDeck: Dispatch<SetStateAction<BattleCard[]>> }) {
  const potion = getRandomPotionCard();
  appendCardToRunWithDiscovery(potion, setRunDeck);
}
