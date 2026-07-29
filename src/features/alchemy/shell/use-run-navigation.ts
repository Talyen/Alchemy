// Run-flow controller for routing, rewards, mysteries, campfires, act transitions, and reset.
// Depends on: run-session/ui stores, battle system, game constants, audio registry, and navigation flow helpers.
// Depended on by: useAlchemyRunController for managing the overall flow of a run.
import {
  useRunAdapter,
  useTalentAdapter,
  useSetHasActiveBattle,
  useRunSessionNavigationSlice,
} from "@/features/alchemy/shared/stores/run-session-facade";
import { useProfileStore } from "@/features/alchemy/shared/stores/profile-store";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
// Side-effect: registers presentation cleanup with the shared bridge.
import "@/features/alchemy/run-loop/battle/battle-presentation-store";
import { type BattleCard, type CharacterId, type DifficultyId, type DifficultyModifier } from "@/lib/game-data";
import { CONSTANTS, type Screen } from "@/features/alchemy/shared/types";
import type { ScreenTransitionOptions } from "./use-screen-transitions";
import { useWildwoodGauntletFlow } from "./use-wildwood-gauntlet-flow";
import type { WildwoodModifierId } from "@/lib/content-systems/wildwood/gauntlet";
import { useRunDestinationWiring } from "./use-run-destination-wiring";
import { useContentSystemNavigation } from "./use-content-system-navigation";
import { useMysteryEventNavigation } from "./use-mystery-event-navigation";
import { useRunFlowHandlers } from "./use-run-flow-handlers";
import { useRunCorruptionFlow } from "./use-run-corruption-flow";
import { useRunTeardown } from "./use-run-teardown";

export function useRunNavigation({
  screen,
  navigateTo,
  transition,
  cancelPending,
  onStartBattle,
  onStartBossBattle,
  onStartBossById,
  onLabyrinthClearNode,
  onLabyrinthFailNode,
  onInitShop,
  onInitAlchemist,
  onInitTrinketShop,
  onInitEquipmentShop,
  onMarkDifficultyCompleted,
  randomSources,
}: {
  screen: Screen;
  navigateTo: (nextScreen: Screen, onRenderedScreenCommit?: () => void) => void;
  transition: (nextScreen: Screen, options?: ScreenTransitionOptions) => void;
  cancelPending: () => void;
  onStartBattle: (
    deck?: BattleCard[],
    gold?: number,
    enemyType?: "normal" | "elite",
    modifiers?: DifficultyModifier[],
  ) => void;
  onStartBossBattle: () => void;
  onStartBossById: (
    bossId: string,
    modifiers?: DifficultyModifier[],
    wildwoodModifierId?: WildwoodModifierId,
  ) => boolean;
  onLabyrinthClearNode: () => void;
  onLabyrinthFailNode: () => void;
  onInitShop: () => void;
  onInitAlchemist: () => void;
  onInitTrinketShop: () => void;
  onInitEquipmentShop: () => void;
  onMarkDifficultyCompleted: (characterId: CharacterId, difficultyId: DifficultyId) => void;
  randomSources: {
    rewards: () => number;
    destinations: () => number;
    events: () => number;
    world: () => number;
  };
}) {
  const run = useRunAdapter();
  const talents = useTalentAdapter();
  const setHasActiveBattle = useSetHasActiveBattle();
  const completedDifficulties = useProfileStore((s) => s.completedDifficulties);
  const nav = useRunSessionNavigationSlice(screen);
  const clearCardHover = useUiStore((s) => s.clearCardHover);
  const runPhase = nav.phase;
  const hasActiveBattle = nav.hasActiveBattle;
  const hasActiveRun = nav.hasActiveRun;
  const pendingCharacterId = nav.pendingCharacterId;
  const pendingContentSystemType = nav.pendingContentSystemType;

  const destinations = useRunDestinationWiring({
    run,
    hasActiveBattle,
    navigateTo,
    clearCardHover,
  });

  const wildwood = useWildwoodGauntletFlow({
    run,
    navigateTo,
    onStartBossById,
    setHasActiveBattle,
    clearCardHover,
    rng: randomSources.world,
  });

  const contentNav = useContentSystemNavigation({
    run,
    talents,
    hasActiveRun,
    hasActiveBattle,
    pendingContentSystemType,
    completedDifficulties,
    navigateTo,
    returnToBattle: destinations.returnToBattle,
    onStartBattle,
    getAvailableDestinations: destinations.getAvailableDestinations,
    onResumeWildwood: wildwood.resumeWildwoodRun,
    onStartNextWildwoodBoss: wildwood.startNextWildwoodBoss,
    destinationRng: randomSources.destinations,
    worldRng: randomSources.world,
  });

  function handleDraftComplete(draftedCards: BattleCard[]) {
    if (run.contentSystemType !== CONSTANTS.CONTENT_SYSTEMS.WILDWOOD) {
      contentNav.handleDraftComplete(draftedCards);
      return;
    }
    wildwood.handleDraftComplete(draftedCards);
  }

  const mystery = useMysteryEventNavigation({
    navigateTo,
    eventsRng: randomSources.events,
  });

  const flowHandlers = useRunFlowHandlers({
    run,
    talents,
    navigateTo,
    transition,
    onLabyrinthFailNode,
    onLabyrinthClearNode,
    onInitShop,
    onInitAlchemist,
    onInitTrinketShop,
    onInitEquipmentShop,
    onStartBattle,
    onStartBossBattle,
    onStartBossById,
    onMarkDifficultyCompleted,
    onCommitWildwoodVictory: wildwood.commitWildwoodVictory,
    contentNav,
    getAvailableDestinations: destinations.getAvailableDestinations,
    beginMysteryEvent: mystery.beginMysteryEvent,
    clearMysteryCardChoices: mystery.clearCardChoices,
    onWildwoodRewardComplete: wildwood.handleWildwoodRewardComplete,
    onSelectRewardChoice: wildwood.selectRewardChoice,
    rewardRng: randomSources.rewards,
    destinationRng: randomSources.destinations,
    worldRng: randomSources.world,
  });

  const corruption = useRunCorruptionFlow({
    getRunDeck: () => run.runDeck,
    setRunDeck: run.setRunDeck,
    eventsRng: randomSources.events,
    advanceToNextDestination: flowHandlers.advanceToNextDestination,
  });

  const teardown = useRunTeardown({
    cancelPending,
    setHasActiveBattle,
    clearCardHover,
    navigateTo,
  });

  function handleMysteryContinue() {
    flowHandlers.advanceToNextDestination();
  }

  return {
    runPhase,
    get activeRunData(): boolean {
      return hasActiveRun;
    },
    get pendingCharacterId() {
      return pendingCharacterId;
    },
    getAvailableDestinations: destinations.getAvailableDestinations,
    advanceToNextDestination: flowHandlers.advanceToNextDestination,
    beginCampaign: contentNav.beginCampaign,
    beginLabyrinth: contentNav.beginLabyrinth,
    beginWildwood: contentNav.beginWildwood,
    beginMysteryEvent: mystery.beginMysteryEvent,
    endLabyrinthRun: flowHandlers.endLabyrinthRun,
    handleAbandonRun: flowHandlers.handleAbandonRun,
    handleCharacterSelect: contentNav.handleCharacterSelect,
    handleDraftComplete,
    handleDraftPick: wildwood.handleDraftPick,
    handleDifficultySelect: contentNav.handleDifficultySelect,
    handleBackFromDifficultySelect: contentNav.handleBackFromDifficultySelect,
    returnToBattle: destinations.returnToBattle,
    goToScreen: destinations.goToScreen,
    handleDestinationChoice: flowHandlers.handleDestinationChoice,
    handleActComplete: flowHandlers.handleActComplete,
    finishRewards: flowHandlers.finishRewards,
    selectRewardChoice: flowHandlers.selectRewardChoice,
    handleWildwoodRecoveryComplete: wildwood.handleWildwoodRecoveryComplete,
    handleWildwoodRemoveCard: wildwood.handleWildwoodRemoveCard,
    handleWildwoodSkipRemoval: wildwood.handleWildwoodSkipRemoval,
    prepareDestinationScreen: flowHandlers.prepareDestinationScreen,
    handleCampfireContinue: flowHandlers.handleCampfireContinue,
    handleCorruptCard: corruption.handleCorruptCard,
    handleCorruptionExit: corruption.handleCorruptionExit,
    handleMysteryChoice: mystery.handleMysteryChoice,
    handleMysteryChooseCard: mystery.handleMysteryChooseCard,
    handleMysteryRemoveCard: mystery.handleMysteryRemoveCard,
    handleMysteryContinue,
    resetRunState: teardown.resetRunState,
    continueFromRunEnd: teardown.continueFromRunEnd,
    handleBattleVictory: flowHandlers.handleBattleVictory,
    handleBattleDefeat: flowHandlers.handleBattleDefeat,
  };
}
