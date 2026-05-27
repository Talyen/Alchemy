// Post-reward route resolution and screen transitions after the rewards screen.
import type { BattleCard, TrinketEntry } from "@/lib/game-data";
import type { MaterialInventory } from "@/lib/homestead/types";
import { emptyInventory } from "@/lib/homestead/inventory";
import { CONSTANTS, type Screen } from "../types";
import type { ContentSystemId } from "@/lib/content-systems/types";
import { createNextRewardState, type RewardState } from "./reward-state";

type FinalizeRewardRoute =
  | "companion-reward"
  | "labyrinth-victory"
  | "labyrinth-map"
  | "wildwood-victory"
  | "act-complete"
  | "destination";

export type FinalizeRewardInput = {
  rewardState: RewardState;
  companionRewardCards: BattleCard[] | null;
  contentSystemType: ContentSystemId;
  currentEnemyType: string;
  grantAlchemistReward: boolean;
};

export type FinalizeRewardResult = {
  selectedChoice: BattleCard | TrinketEntry | null;
  selectedRewardType: RewardState["rewardType"];
  materials: MaterialInventory;
  grantAlchemistReward: boolean;
  nextRewardState: RewardState;
  clearCompanionRewardCards: boolean;
  route: FinalizeRewardRoute;
};

function resolveRewardRoute(contentSystemType: ContentSystemId, currentEnemyType: string): FinalizeRewardRoute {
  if (contentSystemType === CONSTANTS.CONTENT_SYSTEMS.LABYRINTH) {
    return currentEnemyType === CONSTANTS.ENEMY_TYPES.BOSS
      ? CONSTANTS.REWARD_ROUTES.LABYRINTH_VICTORY
      : CONSTANTS.REWARD_ROUTES.LABYRINTH_MAP;
  }
  if (contentSystemType === CONSTANTS.CONTENT_SYSTEMS.WILDWOOD) {
    return CONSTANTS.REWARD_ROUTES.WILDWOOD_VICTORY;
  }
  return currentEnemyType === CONSTANTS.ENEMY_TYPES.BOSS
    ? CONSTANTS.REWARD_ROUTES.ACT_COMPLETE
    : CONSTANTS.REWARD_ROUTES.DESTINATION;
}

export function finalizeRewardState({
  rewardState,
  companionRewardCards,
  contentSystemType,
  currentEnemyType,
  grantAlchemistReward,
}: FinalizeRewardInput): FinalizeRewardResult {
  const selectedChoice = rewardState.selectedId
    ? (rewardState.choices.find((choice) => choice.id === rewardState.selectedId) ?? null)
    : null;

  if (companionRewardCards && companionRewardCards.length > 0) {
    return {
      selectedChoice,
      selectedRewardType: rewardState.rewardType,
      materials: rewardState.materials,
      grantAlchemistReward,
      nextRewardState: {
        choices: companionRewardCards,
        gold: 0,
        materials: emptyInventory(),
        selectedId: null,
        destinations: rewardState.destinations,
        rewardType: "card",
        selectedBossId: rewardState.selectedBossId,
      },
      clearCompanionRewardCards: true,
      route: CONSTANTS.REWARD_ROUTES.COMPANION_REWARD,
    };
  }

  const route = resolveRewardRoute(contentSystemType, currentEnemyType);

  return {
    selectedChoice,
    selectedRewardType: rewardState.rewardType,
    materials: rewardState.materials,
    grantAlchemistReward,
    nextRewardState: createNextRewardState(rewardState),
    clearCompanionRewardCards: false,
    route,
  };
}

export type RewardRouteTransitionHandlers = {
  navigateTo: (screen: Screen, onRenderedScreenCommit?: () => void) => void;
  completeRunVictory: (materials: MaterialInventory, onRenderedScreenCommit?: () => void) => void;
  handleActComplete: (materials: MaterialInventory) => void;
  onLabyrinthClearNode: () => void;
  setCompanionRewardCards: (cards: BattleCard[] | null) => void;
  setRewardState: (state: RewardState) => void;
};

export function executeRewardRouteTransition(
  route: FinalizeRewardResult["route"],
  materials: MaterialInventory,
  nextRewardState: RewardState,
  clearCompanion: boolean,
  handlers: RewardRouteTransitionHandlers,
) {
  const setReward = () => handlers.setRewardState(nextRewardState);

  if (route === CONSTANTS.REWARD_ROUTES.COMPANION_REWARD) {
    if (clearCompanion) handlers.setCompanionRewardCards(null);
    handlers.navigateTo(CONSTANTS.SCREENS.REWARDS, setReward);
    return;
  }

  if (route === CONSTANTS.REWARD_ROUTES.LABYRINTH_VICTORY || route === CONSTANTS.REWARD_ROUTES.WILDWOOD_VICTORY) {
    handlers.completeRunVictory(materials, setReward);
    return;
  }

  if (route === CONSTANTS.REWARD_ROUTES.LABYRINTH_MAP) {
    handlers.onLabyrinthClearNode();
    handlers.navigateTo(CONSTANTS.SCREENS.LABYRINTH_MAP, setReward);
    return;
  }

  if (route === CONSTANTS.REWARD_ROUTES.ACT_COMPLETE) {
    handlers.handleActComplete(materials);
    return;
  }

  handlers.navigateTo(CONSTANTS.SCREENS.DESTINATION, setReward);
}
