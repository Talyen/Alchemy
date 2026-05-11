import { useEffect, useRef, useState } from "react";
import { cardLibrary, trinketLibrary, type CharacterId } from "@/lib/game-data";
import type { TalentXP } from "@/lib/talents";
import type { HomesteadEffectManifest, MaterialInventory } from "@/lib/homestead/types";
import type { UnlockedTalents } from "./talent-pool";
import { useTalentState } from "./use-talent-state";
import { useRunState } from "./use-run-state";
import { useBattleController } from "./use-battle-controller";
import { useShopController } from "./use-shop-controller";
import { useRunNavigation } from "./use-run-navigation";
import type { CombatTextAnimationVariant, Screen } from "./types";

export function useAlchemyRunController({
  discoveredCardIds, setDiscoveredCardIds, setEncounteredEnemyIds,
  setDiscoveredTrinketIds,
  initialTalentXP, initialUnlockedTalents, initialActiveRun, autoEndTurn,
  combatTextAnimationVariant,
  onAddMaterials, onTriggerFarmYield, homesteadEffects,
}: {
  discoveredCardIds: string[];
  setDiscoveredCardIds: React.Dispatch<React.SetStateAction<string[]>>;
  setEncounteredEnemyIds: React.Dispatch<React.SetStateAction<string[]>>;
  setDiscoveredTrinketIds: React.Dispatch<React.SetStateAction<string[]>>;
  initialTalentXP: TalentXP; initialUnlockedTalents: UnlockedTalents;
  initialActiveRun: { characterId: CharacterId } | null;
  autoEndTurn: boolean;
  combatTextAnimationVariant: CombatTextAnimationVariant;
  onAddMaterials: (materials: MaterialInventory) => void;
  onTriggerFarmYield: () => void;
  homesteadEffects: HomesteadEffectManifest;
}) {
  // ============ Sub-hooks ============
  const talents = useTalentState(initialTalentXP, initialUnlockedTalents);
  const run = useRunState(initialActiveRun);

  // ============ Shared State ============
  const [screen, setScreen] = useState<Screen>("menu");
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);

  // ============ Screen Navigation ============
  const navTimerRef = useRef<number>(0);

  function navigateTo(nextScreen: Screen) {
    window.clearTimeout(navTimerRef.current);
    navTimerRef.current = window.setTimeout(() => setScreen(nextScreen), 100);
  }

  // ============ Ref Wrappers ============
  const onAddMaterialsRef = useRef(onAddMaterials);
  const onTriggerFarmYieldRef = useRef(onTriggerFarmYield);
  const homesteadEffectsRef = useRef(homesteadEffects);
  useEffect(() => { onAddMaterialsRef.current = onAddMaterials; }, [onAddMaterials]);
  useEffect(() => { onTriggerFarmYieldRef.current = onTriggerFarmYield; }, [onTriggerFarmYield]);
  useEffect(() => { homesteadEffectsRef.current = homesteadEffects; }, [homesteadEffects]);

  // ============ Domain Controllers ============
  const battle = useBattleController({
    run, talents,
    discoveredCardIds, setDiscoveredCardIds, setEncounteredEnemyIds,
    autoEndTurn, combatTextAnimationVariant, homesteadEffectsRef, screen,
    setHoveredCardId,
    initialHasActiveBattle: initialActiveRun !== null,
  });

  const shop = useShopController({
    run, talents,
    setDiscoveredCardIds,
  });

  const nav = useRunNavigation({
    run, talents,
    screen, setScreen, navigateTo,
    battleState: battle.battleState,
    hasActiveBattle: battle.hasActiveBattle,
    setHasActiveBattle: battle.setHasActiveBattle,
    battleStateRef: battle.battleStateRef,
    clearCardGhosts: battle.clearCardGhosts,
    setBattleState: battle.setBattleState,
    setDiscoveredCardIds,
    setEncounteredEnemyIds, setDiscoveredTrinketIds,
    onAddMaterialsRef, onTriggerFarmYieldRef, homesteadEffectsRef,
    setHoveredCardId,
    onStartBattle: battle.startBattle,
    onStartBossBattle: battle.startBossBattle,
    onInitShop: shop.initShop,
    onInitAlchemist: shop.initAlchemist,
  });

  function clearPermanentData() { talents.clearPermanentData(); }

  return {
    screen,
    battleState: battle.battleState,
    hoveredCardId, hasActiveBattle: battle.hasActiveBattle,
    runDeck: run.runDeck, runGold: run.runGold, runPlayerHealth: run.runPlayerHealth, runMaxHealth: run.runMaxHealth,
    runTrinkets: run.runTrinkets, roomsEncountered: run.roomsEncountered,
    currentAct: run.currentAct, destinationIndexInAct: run.destinationIndexInAct,
    completedDestinations: run.completedDestinations,
    characterId: run.characterId,
    talentXP: talents.talentXP, runTalentXP: talents.runTalentXP, unlockedTalents: talents.unlockedTalents,
    unlockTalent: talents.unlockTalent, unlockAllTalents: talents.unlockAllTalents, resetUnlockedTalents: talents.resetUnlockedTalents,
    clearPermanentData,
    setRewardState: nav.setRewardState, setHoveredCardId,
    setSelectedRewardId: nav.setSelectedRewardId,
    get rewardChoices() { return nav.rewardChoices; },
    get rewardGold() { return nav.rewardGold; },
    get rewardMaterials() { return nav.rewardMaterials; },
    get rewardType() { return nav.rewardType; },
    get selectedRewardId() { return nav.selectedRewardId; },
    get destinationOptions() { return nav.destinationOptions; },
    get shopCards() { return shop.shopCards; },
    get shopRefreshesLeft() { return shop.shopRefreshesLeft; },
    get shopRemoveUsed() { return shop.shopRemoveUsed; },
    get alchemistPotions() { return shop.alchemistPotions; },
    get alchemistRefreshesLeft() { return shop.alchemistRefreshesLeft; },
    get alchemistPotionPrice() { return shop.alchemistPotionPrice; },
    get alchemistMixPrice() { return shop.alchemistMixPrice; },
    get alchemistMixUsed() { return shop.alchemistMixUsed; },
    get mysteryEvent() { return nav.mysteryEvent; },
    get activeRunData() { return nav.activeRunData; },
    handCardRefs: battle.handCardRefs,
    battleSceneRef: battle.battleSceneRef,
    playerPanelRef: battle.playerPanelRef,
    enemyPanelRef: battle.enemyPanelRef,
    destinationButtonRefs: nav.destinationButtonRefs,
    cardGhosts: battle.cardGhosts,
    shimmerState: battle.shimmerState,
    playerStatusChips: battle.playerStatusChips, enemyStatusChips: battle.enemyStatusChips,
    playerCombatTexts: battle.playerCombatTexts, enemyCombatTexts: battle.enemyCombatTexts,
    combatTextAnimationVariant: battle.combatTextAnimationVariant,
    enemyShaking: battle.enemyShaking, playerShaking: battle.playerShaking, companionShaking: battle.companionShaking,
    beginRun: nav.beginRun, handleCharacterSelect: nav.handleCharacterSelect,
    returnToBattle: nav.returnToBattle, goToScreen: nav.goToScreen,
    maybeTriggerShimmer: battle.maybeTriggerShimmer,
    handleCardClick: battle.handleCardClick, handleWishChoice: battle.handleWishChoice,
    finishRewards: nav.finishRewards,
    handleDestinationChoice: nav.handleDestinationChoice,
    handleCampfireContinue: nav.handleCampfireContinue,
    handleShopBuyCard: shop.handleShopBuyCard, handleShopRemoveCard: shop.handleShopRemoveCard,
    handleShopRefresh: shop.handleShopRefresh,
    handleShopContinue: nav.advanceToNextDestination,
    handleAlchemistBuyCard: shop.handleAlchemistBuyCard, handleAlchemistRefresh: shop.handleAlchemistRefresh,
    handleAlchemistMixPotions: shop.handleAlchemistMixPotions,
    handleAlchemistContinue: nav.advanceToNextDestination,
    handleMysteryChoice: nav.handleMysteryChoice,
    handleMysteryChooseCard: nav.handleMysteryChooseCard,
    handleMysteryRemoveCard: nav.handleMysteryRemoveCard,
    handleMysteryContinue: nav.handleMysteryContinue,
    get mysteryCardChoices() { return nav.mysteryCardChoices; },
    handleActComplete: nav.handleActComplete,
    handleEndTurn: battle.handleEndTurn, handleEndRun: battle.handleEndRun,
    skipCombatDevMode: battle.skipCombatDevMode,
    removeCardGhost: battle.removeCardGhost,
    resetRunState: nav.resetRunState,
    findCard: (id: string) => cardLibrary.find((c) => c.id === id),
    findTrinket: (id: string) => trinketLibrary.find((t) => t.id === id),
  };
}
