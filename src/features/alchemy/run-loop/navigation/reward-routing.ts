// Post-reward route resolution and screen transitions after the rewards screen.
import type { BattleCard, TrinketEntry } from "@/lib/game-data";
import type { MaterialInventory } from "@/lib/homestead/types";
import { emptyInventory } from "@/lib/homestead/inventory";
import { CONSTANTS, type Screen } from "../../shared/types";
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

type RewardRouteTransitionContext = {
  materials: MaterialInventory;
  nextRewardState: RewardState;
  clearCompanion: boolean;
  setReward: () => void;
};

const REWARD_ROUTE_HANDLERS: Record<
  FinalizeRewardResult["route"],
  (handlers: RewardRouteTransitionHandlers, ctx: RewardRouteTransitionContext) => void
> = {
  [CONSTANTS.REWARD_ROUTES.COMPANION_REWARD]: (handlers, { clearCompanion, setReward }) => {
    if (clearCompanion) handlers.setCompanionRewardCards(null);
    handlers.navigateTo(CONSTANTS.SCREENS.REWARDS, setReward);
  },
  [CONSTANTS.REWARD_ROUTES.LABYRINTH_VICTORY]: (handlers, { materials, setReward }) => {
    handlers.completeRunVictory(materials, setReward);
  },
  [CONSTANTS.REWARD_ROUTES.WILDWOOD_VICTORY]: (handlers, { materials, setReward }) => {
    handlers.completeRunVictory(materials, setReward);
  },
  [CONSTANTS.REWARD_ROUTES.LABYRINTH_MAP]: (handlers, { setReward }) => {
    handlers.onLabyrinthClearNode();
    handlers.navigateTo(CONSTANTS.SCREENS.LABYRINTH_MAP, setReward);
  },
  [CONSTANTS.REWARD_ROUTES.ACT_COMPLETE]: (handlers, { materials }) => {
    handlers.handleActComplete(materials);
  },
  [CONSTANTS.REWARD_ROUTES.DESTINATION]: (handlers, { setReward }) => {
    handlers.navigateTo(CONSTANTS.SCREENS.DESTINATION, setReward);
  },
};

export function executeRewardRouteTransition(
  route: FinalizeRewardResult["route"],
  materials: MaterialInventory,
  nextRewardState: RewardState,
  clearCompanion: boolean,
  handlers: RewardRouteTransitionHandlers,
) {
  const setReward = () => handlers.setRewardState(nextRewardState);
  REWARD_ROUTE_HANDLERS[route](handlers, { materials, nextRewardState, clearCompanion, setReward });
}
