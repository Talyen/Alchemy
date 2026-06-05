// Types and initial state for the consolidated run domain store.
import type { BattleCard } from "@/lib/game-data";
import { defaultBattleState, type BattleState, type PlayerStatusValues, type TurnPhase } from "@/lib/battle";
import { generateLabyrinthMap } from "@/lib/content-systems/labyrinth/map-generation";
import { createEmptyRewardState } from "@/features/alchemy/navigation/reward-flow";
import { SHOP_REFRESHES, ALCHEMIST_REFRESHES } from "@/lib/game-constants";
import type { ShopState, AlchemistState } from "@/features/alchemy/shop/shop-state-init";
import {
  createInitialRunState,
  createInitialTalentState,
  type RunStateFields,
} from "@/features/alchemy/run-setup/run/run-state-init";
import type { RunSessionFields } from "./run-session-store-types";
import type { Screen } from "@/features/alchemy/types";

export type DisplayOverrides = {
  /** Shallow-merged via `{ ...battleState, ...displayOverrides }`. Only use top-level primitive fields. */
  hand?: BattleCard[];
  turnPhase?: TurnPhase;
  playerHealth?: number;
  playerStatuses?: PlayerStatusValues;
};

export type RunDomainBattleState = {
  battleState: BattleState;
  displayOverrides: DisplayOverrides;
  battleStartState: BattleState | null;
  hasActiveBattle: boolean;
};

type RunDomainNavigationState = {
  screen: Screen;
};

export type RunDomainDataState = {
  progress: RunStateFields;
  session: RunSessionFields;
  navigation: RunDomainNavigationState;
  battle: RunDomainBattleState;
};

const emptyShop: ShopState = {
  cards: [],
  refreshesLeft: SHOP_REFRESHES,
  removeUsed: false,
  firstPurchaseUsed: false,
};

const emptyAlchemist: AlchemistState = {
  potions: [],
  refreshesLeft: ALCHEMIST_REFRESHES,
  mixUsed: false,
  firstPurchaseUsed: false,
};

export function createInitialSessionFields(): RunSessionFields {
  return {
    hasActiveRun: false,
    activeLabyrinthModifiers: [],
    activeLabyrinthRewardModifiers: [],
    activeLabyrinthPendingNode: null,
    rewardState: createEmptyRewardState(),
    companionRewardCards: null,
    runEndMaterials: { wood: 0, iron: 0, herbs: 0, food: 0, crystal: 0 },
    runEndTalentXP: {},
    corruptionResult: null,
    pendingCharacterId: null,
    pendingContentSystemType: "campaign",
    labyrinthMap: generateLabyrinthMap(),
    shopState: emptyShop,
    alchemistState: emptyAlchemist,
    mysteryEvent: null,
    mysteryCardChoices: null,
  };
}

export function createInitialProgressFields(): RunStateFields {
  return {
    ...createInitialRunState(null),
    ...createInitialTalentState({}, {}),
  };
}

export function createInitialBattleFields(): RunDomainBattleState {
  return {
    battleState: defaultBattleState(),
    displayOverrides: {},
    battleStartState: null,
    hasActiveBattle: false,
  };
}

export function createInitialRunDomainData(): RunDomainDataState {
  return {
    progress: createInitialProgressFields(),
    session: createInitialSessionFields(),
    navigation: { screen: "menu" },
    battle: createInitialBattleFields(),
  };
}
