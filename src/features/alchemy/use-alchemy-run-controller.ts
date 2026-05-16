// Top-level alchemy controller composition hook.
// Depends on run, battle, shop, navigation, talent, persistence-facing, and homestead state.
// Used by App as the single UI-facing API while domain rules stay in smaller controllers.
import { useEffect, useRef, useState } from "react";
import { cardLibrary, trinketLibrary } from "@/lib/game-data";
import type { TalentXP } from "@/lib/talents";
import type { HomesteadEffectManifest, MaterialInventory } from "@/lib/homestead/types";
import type { CharacterId, DifficultyId, UnlockedTalents } from "@/lib/game-data";
import { useTalentState } from "./use-talent-state";
import { useRunState } from "./use-run-state";
import { useBattleController } from "./use-battle-controller";
import { useShopController } from "./use-shop-controller";
import { useRunNavigation } from "./use-run-navigation";
import type { Screen } from "./types";
import type { ActiveRunData } from "./run/types";
import { NAVIGATION_DELAY_MS } from "@/lib/game-constants";

export function useAlchemyRunController({
  discoveredCardIds,
  setDiscoveredCardIds,
  setEncounteredEnemyIds,
  setDiscoveredTrinketIds,
  initialTalentXP,
  initialUnlockedTalents,
  initialActiveRun,
  autoEndTurn,
  onAddMaterials,
  homesteadEffects,
  onMarkDifficultyCompleted,
  completedDifficulties,
}: {
  discoveredCardIds: string[];
  setDiscoveredCardIds: React.Dispatch<React.SetStateAction<string[]>>;
  setEncounteredEnemyIds: React.Dispatch<React.SetStateAction<string[]>>;
  setDiscoveredTrinketIds: React.Dispatch<React.SetStateAction<string[]>>;
  initialTalentXP: TalentXP;
  initialUnlockedTalents: UnlockedTalents;
  initialActiveRun: ActiveRunData | null;
  autoEndTurn: boolean;
  onAddMaterials: (materials: MaterialInventory) => void;
  homesteadEffects: HomesteadEffectManifest;
  onMarkDifficultyCompleted: (characterId: CharacterId, difficultyId: DifficultyId) => void;
  completedDifficulties: Record<CharacterId, DifficultyId[]>;
}) {
  // This hook composes domain controllers and exposes a stable UI API; it intentionally
  // avoids owning combat/shop/navigation rules directly so those modules stay testable.
  // ============ Sub-hooks ============
  const talents = useTalentState(initialTalentXP, initialUnlockedTalents);
  const run = useRunState(initialActiveRun);

  // ============ Shared State ============
  const [screen, setScreen] = useState<Screen>("menu");
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [hasActiveRun, setHasActiveRun] = useState(initialActiveRun !== null);

  // ============ Screen Navigation ============
  const navTimerRef = useRef<number>(0);

  function navigateTo(nextScreen: Screen) {
    // Screen changes are delayed for transition pacing, and clearing the previous timer
    // prevents rapid clicks from racing multiple navigation commits.
    window.clearTimeout(navTimerRef.current);
    navTimerRef.current = window.setTimeout(() => setScreen(nextScreen), NAVIGATION_DELAY_MS);
  }

  // ============ Ref Wrappers ============
  const onAddMaterialsRef = useRef(onAddMaterials);
  const homesteadEffectsRef = useRef(homesteadEffects);
  useEffect(() => {
    onAddMaterialsRef.current = onAddMaterials;
  }, [onAddMaterials]);
  useEffect(() => {
    homesteadEffectsRef.current = homesteadEffects;
  }, [homesteadEffects]);

  // ============ Domain Controllers ============
  const battle = useBattleController({
    run,
    talents,
    discoveredCardIds,
    setDiscoveredCardIds,
    setEncounteredEnemyIds,
    autoEndTurn,
    homesteadEffectsRef,
    screen,
    setHoveredCardId,
    initialHasActiveBattle: false,
  });

  const shop = useShopController({
    run,
    talents,
    setDiscoveredCardIds,
  });

  const nav = useRunNavigation({
    run,
    talents,
    screen,
    setScreen,
    navigateTo,
    battleState: battle.battleState,
    hasActiveBattle: battle.hasActiveBattle,
    setHasActiveBattle: battle.setHasActiveBattle,
    hasActiveRun,
    setHasActiveRun,
    currentEnemyType: battle.battleState.currentEnemy.enemyType,
    clearCardGhosts: battle.clearCardGhosts,
    setBattleState: battle.setBattleState,
    setDiscoveredCardIds,
    setEncounteredEnemyIds,
    setDiscoveredTrinketIds,
    onAddMaterialsRef,
    homesteadEffectsRef,
    setHoveredCardId,
    onStartBattle: battle.startBattle,
    onStartBossBattle: battle.startBossBattle,
    onInitShop: shop.initShop,
    onInitAlchemist: shop.initAlchemist,
    onMarkDifficultyCompleted,
    completedDifficulties,
  });

  function clearPermanentData() {
    talents.clearPermanentData();
  }

  return {
    screen,
    battleState: battle.battleState,
    hoveredCardId,
    hasActiveBattle: battle.hasActiveBattle,
    hasActiveRun,
    runDeck: run.runDeck,
    runGold: run.runGold,
    runPlayerHealth: run.runPlayerHealth,
    runMaxHealth: run.runMaxHealth,
    runTrinkets: run.runTrinkets,
    roomsEncountered: run.roomsEncountered,
    currentAct: run.currentAct,
    destinationIndexInAct: run.destinationIndexInAct,
    completedDestinations: run.completedDestinations,
    characterId: run.characterId,
    pendingCharacterId: nav.pendingCharacterId,
    talentXP: talents.talentXP,
    runTalentXP: talents.runTalentXP,
    unlockedTalents: talents.unlockedTalents,
    unlockTalent: talents.unlockTalent,
    unlockAllTalents: talents.unlockAllTalents,
    resetUnlockedTalents: talents.resetUnlockedTalents,
    clearPermanentData,
    setRewardState: nav.setRewardState,
    setHoveredCardId,
    setSelectedRewardId: nav.setSelectedRewardId,
    get rewardChoices() {
      return nav.rewardChoices;
    },
    get rewardGold() {
      return nav.rewardGold;
    },
    get rewardMaterials() {
      return nav.rewardMaterials;
    },
    get rewardType() {
      return nav.rewardType;
    },
    get selectedRewardId() {
      return nav.selectedRewardId;
    },
    get destinationOptions() {
      return nav.destinationOptions;
    },
    get shopCards() {
      return shop.shopCards;
    },
    get shopCardPrice() {
      return shop.shopCardPrice;
    },
    get shopRemovePrice() {
      return shop.shopRemovePrice;
    },
    get shopRefreshPrice() {
      return shop.shopRefreshPrice;
    },
    get shopRefreshesLeft() {
      return shop.shopRefreshesLeft;
    },
    get shopRemoveUsed() {
      return shop.shopRemoveUsed;
    },
    get alchemistPotions() {
      return shop.alchemistPotions;
    },
    get alchemistRefreshesLeft() {
      return shop.alchemistRefreshesLeft;
    },
    get alchemistPotionPrice() {
      return shop.alchemistPotionPrice;
    },
    get alchemistMixPrice() {
      return shop.alchemistMixPrice;
    },
    get alchemistMixUsed() {
      return shop.alchemistMixUsed;
    },
    get runEndMaterials() {
      return nav.runEndMaterials;
    },
    get mysteryEvent() {
      return nav.mysteryEvent;
    },
    get corruptionResult() {
      return nav.corruptionResult;
    },
    get activeRunData() {
      return nav.activeRunData;
    },
    handCardRefs: battle.handCardRefs,
    battleSceneRef: battle.battleSceneRef,
    playerPanelRef: battle.playerPanelRef,
    enemyPanelRef: battle.enemyPanelRef,
    destinationButtonRefs: nav.destinationButtonRefs,
    cardGhosts: battle.cardGhosts,
    shimmerState: battle.shimmerState,
    playerStatusChips: battle.playerStatusChips,
    enemyStatusChips: battle.enemyStatusChips,
    playerCombatTexts: battle.playerCombatTexts,
    enemyCombatTexts: battle.enemyCombatTexts,
    enemyShaking: battle.enemyShaking,
    playerShaking: battle.playerShaking,
    companionShaking: battle.companionShaking,
    beginRun: nav.beginRun,
    handleCharacterSelect: nav.handleCharacterSelect,
    handleDifficultySelect: nav.handleDifficultySelect,
    handleBackFromDifficultySelect: nav.handleBackFromDifficultySelect,
    returnToBattle: nav.returnToBattle,
    goToScreen: nav.goToScreen,
    maybeTriggerShimmer: battle.maybeTriggerShimmer,
    handleCardClick: battle.handleCardClick,
    handleWishChoice: battle.handleWishChoice,
    finishRewards: nav.finishRewards,
    handleDestinationChoice: nav.handleDestinationChoice,
    handleCampfireContinue: nav.handleCampfireContinue,
    handleShopBuyCard: shop.handleShopBuyCard,
    handleShopRemoveCard: shop.handleShopRemoveCard,
    handleShopRefresh: shop.handleShopRefresh,
    handleShopContinue: nav.advanceToNextDestination,
    handleAlchemistBuyCard: shop.handleAlchemistBuyCard,
    handleAlchemistRefresh: shop.handleAlchemistRefresh,
    handleAlchemistMixPotions: shop.handleAlchemistMixPotions,
    handleAlchemistContinue: nav.advanceToNextDestination,
    handleMysteryChoice: nav.handleMysteryChoice,
    handleMysteryChooseCard: nav.handleMysteryChooseCard,
    handleMysteryRemoveCard: nav.handleMysteryRemoveCard,
    handleMysteryContinue: nav.handleMysteryContinue,
    handleCorruptCard: nav.handleCorruptCard,
    handleCorruptionContinue: nav.handleCorruptionContinue,
    handleCorruptionLeave: nav.handleCorruptionLeave,
    get mysteryCardChoices() {
      return nav.mysteryCardChoices;
    },
    handleActComplete: nav.handleActComplete,
    handleEndTurn: battle.handleEndTurn,
    handleEndRun: battle.handleEndRun,
    skipCombatDevMode: battle.skipCombatDevMode,
    removeCardGhost: battle.removeCardGhost,
    resetRunState: nav.resetRunState,
    findCard: (id: string) => cardLibrary.find((c) => c.id === id),
    findTrinket: (id: string) => trinketLibrary.find((t) => t.id === id),
  };
}
