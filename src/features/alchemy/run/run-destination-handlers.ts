// Reward finalization, destination routing, act transitions, and run completion.
import type { Dispatch, SetStateAction } from "react";
import type { BattleCard, CharacterId, DifficultyId, DifficultyModifier } from "@/lib/game-data";
import type { LabyrinthModifierKind } from "@/lib/content-systems/types";
import { useBattleStore } from "../stores/battle-store";
import { useHomesteadStore } from "../stores/homestead-store";
import {
  defaultRunSessionStoreAccess,
  defaultUiStoreAccess,
  type RunSessionStoreAccess,
  type UiStoreAccess,
} from "../stores/store-access";
import { playUISound } from "@/lib/audio";
import { ACTS_PER_RUN, CAMPFIRE_HEAL_FRACTION } from "@/lib/game-constants";
import type { MaterialInventory } from "@/lib/homestead/types";
import {
  finalizeRewardState,
  getActiveRewardModifiersForContentSystem,
  shouldGrantAlchemistReward,
  executeRewardRouteTransition,
  type RewardState,
} from "../navigation/reward-flow";
import { getRandomPotionCard } from "../navigation/reward-gold";
import { applyRunDefeatTeardown, getPreviousDestination } from "../navigation/run-navigation-helpers";
import { appendCardToRunWithDiscovery, appendTrinketToRunWithDiscovery } from "./deck-mutations";
import type { ContentSystemNavigationApi } from "./content-system-navigation";
import { getBossById, getBossEnemy } from "../config";
import { CONSTANTS, type Destination, type Screen } from "../types";
import type { RunStateController, TalentStateController } from "../stores/run-store";

type FinalizeRewardResultType = ReturnType<typeof finalizeRewardState>;

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
  choice: BattleCard | { id: string };
  type: RewardState["rewardType"];
  setRunDeck: Dispatch<SetStateAction<BattleCard[]>>;
  setRunTrinkets: Dispatch<SetStateAction<string[]>>;
  setDiscoveredCardIds: Dispatch<SetStateAction<string[]>>;
  setDiscoveredTrinketIds: Dispatch<SetStateAction<string[]>>;
};

export function applyRewardSelection({
  choice,
  type,
  setRunDeck,
  setRunTrinkets,
  setDiscoveredCardIds,
  setDiscoveredTrinketIds,
}: RewardSelectionInput) {
  const selectedId = choice.id;
  if (type === "card") {
    appendCardToRunWithDiscovery(choice as BattleCard, { setRunDeck, setDiscoveredCardIds });
  } else {
    appendTrinketToRunWithDiscovery(selectedId, { setRunTrinkets, setDiscoveredTrinketIds });
  }
}

export function applyAlchemistPotion({
  setRunDeck,
  setDiscoveredCardIds,
}: {
  setRunDeck: Dispatch<SetStateAction<BattleCard[]>>;
  setDiscoveredCardIds: Dispatch<SetStateAction<string[]>>;
}) {
  const potion = getRandomPotionCard();
  appendCardToRunWithDiscovery(potion, { setRunDeck, setDiscoveredCardIds });
}

export type RunDestinationHandlerDeps = {
  run: RunStateController;
  talents: TalentStateController;
  activeLabyrinthRewardModifiers: LabyrinthModifierKind[];
  navigateTo: (nextScreen: Screen, onRenderedScreenCommit?: () => void) => void;
  setScreen: React.Dispatch<React.SetStateAction<Screen>>;
  setHasActiveBattle: (value: boolean) => void;
  setDiscoveredCardIds: React.Dispatch<React.SetStateAction<string[]>>;
  setDiscoveredTrinketIds: React.Dispatch<React.SetStateAction<string[]>>;
  onInitShop: () => void;
  onInitAlchemist: () => void;
  onStartBattle: (deck?: BattleCard[], gold?: number, enemyType?: "normal" | "elite") => void;
  onStartBossBattle: () => void;
  onStartBossById: (bossId: string, modifiers?: DifficultyModifier[]) => boolean;
  onLabyrinthClearNode: () => void;
  onMarkDifficultyCompleted: (characterId: CharacterId, difficultyId: DifficultyId) => void;
  contentNav: Pick<ContentSystemNavigationApi, "createInitialDestinations">;
  awardRunEndMaterials: (displayMaterials?: MaterialInventory | null) => MaterialInventory;
  clearCombatState: () => void;
  beginMysteryEvent: () => void;
  clearMysteryCardChoices: () => void;
  getRunSessionStore?: RunSessionStoreAccess;
  getUiStore?: UiStoreAccess;
};

export function createRunDestinationHandlers(deps: RunDestinationHandlerDeps) {
  const getStore = deps.getRunSessionStore ?? defaultRunSessionStoreAccess;
  const getUi = deps.getUiStore ?? defaultUiStoreAccess;

  function routeAfterReward(
    route: FinalizeRewardResultType["route"],
    materials: MaterialInventory,
    nextRewardState: RewardState,
    clearCompanion: boolean,
  ) {
    const store = getStore();
    executeRewardRouteTransition(route, materials, nextRewardState, clearCompanion, {
      navigateTo: deps.navigateTo,
      completeRunVictory,
      handleActComplete,
      onLabyrinthClearNode: deps.onLabyrinthClearNode,
      setCompanionRewardCards: store.setCompanionRewardCards,
      setRewardState: store.setRewardState,
    });
  }

  function applyFinalizedRewards(result: ReturnType<typeof finalizeRewardState>) {
    if (result.selectedChoice) {
      applyRewardSelection({
        choice: result.selectedChoice,
        type: result.selectedRewardType,
        setRunDeck: deps.run.setRunDeck,
        setRunTrinkets: deps.run.setRunTrinkets,
        setDiscoveredCardIds: deps.setDiscoveredCardIds,
        setDiscoveredTrinketIds: deps.setDiscoveredTrinketIds,
      });
      playUISound("talentUnlock");
    }

    if (result.grantAlchemistReward) {
      applyAlchemistPotion({
        setRunDeck: deps.run.setRunDeck,
        setDiscoveredCardIds: deps.setDiscoveredCardIds,
      });
    }
  }

  function finishRewards() {
    const screenStore = getStore();
    const battleStateVal = useBattleStore.getState().battleState;
    const result = finalizeRewardState({
      rewardState: screenStore.rewardState,
      companionRewardCards: screenStore.companionRewardCards,
      contentSystemType: deps.run.contentSystemType,
      currentEnemyType: battleStateVal.currentEnemy.enemyType,
      grantAlchemistReward: shouldGrantAlchemistReward(
        getActiveRewardModifiersForContentSystem(deps.run.contentSystemType, deps.activeLabyrinthRewardModifiers),
      ),
    });

    useHomesteadStore.getState().addMaterials(result.materials);
    applyFinalizedRewards(result);
    getUi().clearCardHover();
    routeAfterReward(result.route, result.materials, result.nextRewardState, result.clearCompanionRewardCards);
  }

  function handleDestinationChoice(destination: Destination) {
    const selectedBossId =
      destination === CONSTANTS.DESTINATIONS.BOSS_COMBAT ? getStore().rewardState.selectedBossId : null;
    deps.run.setCompletedDestinations((prev) => [...prev, destination]);
    deps.run.setDestinationIndexInAct((p) => p + 1);
    getUi().clearCardHover();
    routeDestinationChoice(destination, {
      navigateTo: deps.navigateTo,
      beginMysteryEvent: deps.beginMysteryEvent,
      resetCorruption: () => getStore().setCorruptionResult(null),
      startShop: deps.onInitShop,
      startAlchemist: deps.onInitAlchemist,
      startBattle: (enemyType) => deps.onStartBattle(undefined, undefined, enemyType),
      startBossBattle: () => {
        if (selectedBossId && deps.onStartBossById(selectedBossId)) return;
        deps.onStartBossBattle();
      },
    });
  }

  function endLabyrinthRun() {
    if (deps.run.contentSystemType !== CONSTANTS.CONTENT_SYSTEMS.LABYRINTH) return;
    applyRunDefeatTeardown({
      awardRunEndMaterials: deps.awardRunEndMaterials,
      finalizeRunXP: deps.talents.finalizeRunXP,
      clearCombatState: deps.clearCombatState,
    });
    getStore().setHasActiveRun(false);
    deps.setScreen(CONSTANTS.SCREENS.GAME_OVER);
  }

  function handleActComplete(displayMaterials?: MaterialInventory) {
    getUi().clearCardHover();
    deps.setHasActiveBattle(false);

    if (deps.run.currentAct >= ACTS_PER_RUN) {
      if (deps.run.selectedDifficulty) {
        deps.onMarkDifficultyCompleted(deps.run.characterId, deps.run.selectedDifficulty);
      }
      completeRunVictory(displayMaterials);
      return;
    }

    deps.run.setCurrentAct((p) => p + 1);
    deps.run.setDestinationIndexInAct(0);
    deps.run.setCompletedDestinations([]);
    deps.navigateTo(CONSTANTS.SCREENS.DESTINATION, () => {
      getStore().setRewardState(deps.contentNav.createInitialDestinations({ destinationIndexInAct: 0 }));
      prepareDestinationScreen();
    });
  }

  function completeRunVictory(displayMaterials: MaterialInventory | null = null, onRenderedScreenCommit?: () => void) {
    deps.awardRunEndMaterials(displayMaterials);
    deps.talents.finalizeRunXP();
    deps.setHasActiveBattle(false);
    getStore().setHasActiveRun(false);
    deps.navigateTo(CONSTANTS.SCREENS.RUN_VICTORY, onRenderedScreenCommit);
  }

  function advanceToNextDestination() {
    deps.run.setRoomsEncountered((p) => p + 1);
    if (deps.run.contentSystemType === CONSTANTS.CONTENT_SYSTEMS.LABYRINTH) {
      deps.onLabyrinthClearNode();
      getUi().clearCardHover();
      deps.navigateTo(CONSTANTS.SCREENS.LABYRINTH_MAP);
      return;
    }
    const prevDest = getPreviousDestination(deps.run.destinationIndexInAct, deps.run.completedDestinations);
    getUi().clearCardHover();
    deps.clearMysteryCardChoices();
    deps.navigateTo(CONSTANTS.SCREENS.DESTINATION, () => {
      getStore().setRewardState(deps.contentNav.createInitialDestinations(undefined, prevDest));
      prepareDestinationScreen();
    });
  }

  function prepareDestinationScreen() {
    const state = getStore().rewardState;
    const bossOnly = state.destinations.length === 1 && state.destinations[0] === CONSTANTS.DESTINATIONS.BOSS_COMBAT;
    if (!bossOnly) return;
    if (state.selectedBossId && getBossById(state.selectedBossId)) return;
    getStore().setRewardState((prev) => ({ ...prev, selectedBossId: getBossEnemy().id }));
  }

  function selectRewardChoice(id: string) {
    getStore().setRewardState((prev) => ({ ...prev, selectedId: id }));
  }

  function handleCampfireContinue() {
    const healFraction = CAMPFIRE_HEAL_FRACTION + deps.talents.talentEffects.campfireHealBonus;
    deps.run.setRunPlayerHealth((prev) =>
      Math.min(deps.run.runMaxHealth, prev + Math.floor(deps.run.runMaxHealth * healFraction)),
    );
    advanceToNextDestination();
  }

  return {
    finishRewards,
    selectRewardChoice,
    prepareDestinationScreen,
    handleDestinationChoice,
    endLabyrinthRun,
    handleActComplete,
    completeRunVictory,
    advanceToNextDestination,
    handleCampfireContinue,
  };
}
