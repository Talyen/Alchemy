// Root app shell for save data, audio/display side effects, routing, and global layout.
// Depends on alchemy controllers, homestead state, screen modules, assets, and platform/audio helpers.
// Everything visible flows through here, but domain rules stay in feature/lib controllers.
import { useEffect, useRef, useState } from "react";

import {
  allGameArt,
  cardLibrary,
  characterArt,
  characters,
  enemyBestiary,
  keywordDefinitions,
  menuLogo,
  trinketLibrary,
  type KeywordId,
} from "@/lib/game-data";
import { getTalentKeywordProgress } from "@/lib/talents";
import { platform } from "@/lib/platform";
import { preloadAllSounds } from "@/lib/audio";

import { useAppAudioEffects } from "@/app/use-app-audio-effects";
import { useAppDisplayEffects } from "@/app/use-app-display-effects";
import { useScreenAssetPreloadEffects } from "@/app/use-app-preload-effects";
import { useAlchemyAutosave, useAppSaveState } from "@/app/use-app-save-state";
import { useInitialLoadReady } from "@/app/use-initial-load-ready";
import { StartupLoadingScreen } from "@/app/startup-loading-screen";
import { useMobileDetection, useVirtualResolution } from "@/features/alchemy/hooks";
import { BattleScreen } from "@/features/alchemy/screens/battle-screen";
import {
  AlchemistShopScreen,
  CampfireScreen,
  CharacterSelectScreen,
  CollectionScreen,
  CorruptionScreen,
  DestinationScreen,
  GameOverScreen,
  MenuScreen,
  MerchantShopScreen,
  MysteryScreen,
  OptionsScreen,
  RewardsScreen,
  RunVictoryScreen,
  TalentsScreen,
} from "@/features/alchemy/screens";
import type { Screen } from "@/features/alchemy/types";
import { GameMenu } from "@/features/alchemy/ui/shared-ui";
import { useAlchemyRunController } from "@/features/alchemy/use-alchemy-run-controller";
import { useHomesteadState } from "@/features/alchemy/use-homestead-state";
import { buildings, farmPlots, researchUpgrades } from "@/lib/homestead/data";
import { canAfford } from "@/lib/homestead/types";
import { ErrorBoundary } from "@/components/error-boundary";
import { HomesteadScreen } from "@/features/alchemy/screens/homestead-screen";
import { BackgroundParticles } from "@/features/alchemy/ui/background-particles";

const PAGE_EXIT_MS = 130;

const SCREEN_PARTICLE_COLORS: Partial<Record<Screen, readonly string[]>> = {
  battle: ["rgba(255, 150, 70, X)", "rgba(255, 100, 40, X)"],
  campfire: ["rgba(255, 180, 60, X)", "rgba(240, 120, 40, X)"],
  corruption: ["rgba(255, 90, 70, X)", "rgba(230, 60, 50, X)"],
  "run-victory": ["rgba(245, 196, 93, X)", "rgba(255, 220, 120, X)"],
};
const SCREEN_PARTICLE_ALPHA: Partial<Record<Screen, number>> = {
  battle: 1.7,
  corruption: 2.0,
};

const BOSS_ALPHA_MULTIPLIER = 2.5;

export default function App() {
  const save = useAppSaveState();
  const {
    initialSave,
    selectedResolution,
    setSelectedResolution,
    displayMode,
    setDisplayMode,
    uiScale,
    setUiScale,
    brightness,
    setBrightness,
    musicVol,
    setMusicVol,
    sfxVol,
    setSfxVol,
    masterVol,
    setMasterVol,
    muteInBackground,
    setMuteInBackground,
    autoEndTurn,
    setAutoEndTurn,
    showClearSaveConfirm,
    setShowClearSaveConfirm,
    collectionTab,
    collectionPages,
    handleCollectionTabChange,
    setCollectionPage,
    discoveredCardIds,
    setDiscoveredCardIds,
    encounteredEnemyIds,
    setEncounteredEnemyIds,
    discoveredTrinketIds,
    setDiscoveredTrinketIds,
    resetOptionsToDefault,
    clearSavedAppState,
  } = save;
  const [gameMenuOpen, setGameMenuOpen] = useState(false);
  const [menuAnchorRect, setMenuAnchorRect] = useState<DOMRect | null>(null);
  const [renderedScreen, setRenderedScreen] = useState<Screen>("menu");
  const [pagePhase, setPagePhase] = useState<"enter" | "exit">("enter");
  const pendingScreenRef = useRef(renderedScreen);
  const vrStageRef = useRef<HTMLDivElement>(null);
  const initialLoadReady = useInitialLoadReady({ imageUrls: allGameArt });
  useAppDisplayEffects({ displayMode, uiScale, brightness, stageRef: vrStageRef });
  useEffect(() => { preloadAllSounds(); }, []);

  const gameMenuOpenRef = useRef(gameMenuOpen);
  const renderedScreenRef = useRef(renderedScreen);
  // Refs let the global Escape listener read current screen/menu state without re-registering
  // a document-level handler on every route or menu toggle.
  useEffect(() => {
    gameMenuOpenRef.current = gameMenuOpen;
  }, [gameMenuOpen]);
  useEffect(() => {
    renderedScreenRef.current = renderedScreen;
  }, [renderedScreen]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && renderedScreenRef.current !== "menu") {
        if (!gameMenuOpenRef.current) setMenuAnchorRect(null);
        setGameMenuOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const { isMobileLandscape, isPortraitMobile } = useMobileDetection();
  const { frameStyle, stageStyle } = useVirtualResolution(selectedResolution, false, isMobileLandscape);
  const homestead = useHomesteadState({
    materialInventory: initialSave.materialInventory,
    constructedBuildings: initialSave.constructedBuildings,
    plantedFarms: initialSave.plantedFarms,
    completedResearch: initialSave.completedResearch,
  });
  const run = useAlchemyRunController({
    discoveredCardIds,
    setDiscoveredCardIds,
    setEncounteredEnemyIds,
    setDiscoveredTrinketIds,
    initialTalentXP: initialSave.talentXP,
    initialUnlockedTalents: initialSave.unlockedTalents,
    initialActiveRun: initialSave.activeRun,
    autoEndTurn,
    onAddMaterials: homestead.addMaterials,
    homesteadEffects: homestead.effects,
  });
  useAppAudioEffects({ masterVol, musicVol, sfxVol, muteInBackground, screen: run.screen });
  const heroArt = characterArt[run.characterId] ?? characterArt.knight;
  const playerName = characters[run.characterId]?.name ?? "Knight";

  useEffect(() => {
    if (run.screen === renderedScreen) return;
    // renderedScreen intentionally lags the controller screen so exit animation can finish
    // before the next screen mounts and starts its enter animation.
    pendingScreenRef.current = run.screen;
    setPagePhase("exit"); // eslint-disable-line react-hooks/set-state-in-effect
    const timeout = window.setTimeout(() => {
      setRenderedScreen(pendingScreenRef.current);
      setPagePhase("enter");
    }, PAGE_EXIT_MS);
    return () => window.clearTimeout(timeout);
  }, [run.screen, renderedScreen]);

  useScreenAssetPreloadEffects({
    heroArt,
    screen: run.screen,
    battleEnemyArt: run.battleState.currentEnemy.art,
    battleHand: run.battleState.hand,
    rewardChoices: run.rewardChoices,
    shopCards: run.shopCards,
    alchemistPotions: run.alchemistPotions,
    mysteryEvent: run.mysteryEvent,
  });

  useAlchemyAutosave({
    selectedResolution,
    displayMode,
    uiScale,
    discoveredCardIds,
    encounteredEnemyIds,
    discoveredTrinketIds,
    talentXP: run.talentXP,
    unlockedTalents: run.unlockedTalents,
    musicVolume: musicVol,
    sfxVolume: sfxVol,
    masterVolume: masterVol,
    muteInBackground,
    autoEndTurn,
    brightness,
    activeRun: run.activeRunData,
    materialInventory: homestead.materialInventory,
    constructedBuildings: homestead.constructedBuildings,
    plantedFarms: homestead.plantedFarms,
    completedResearch: homestead.completedResearch,
  });

  function clearSaveData() {
    clearSavedAppState();
    run.resetRunState();
    run.clearPermanentData();
    homestead.reset();
  }

  function unlockAllDevMode() {
    setDiscoveredCardIds(cardLibrary.map((card) => card.id));
    setEncounteredEnemyIds(enemyBestiary.map((enemy) => enemy.id));
    setDiscoveredTrinketIds(trinketLibrary.map((trinket) => trinket.id));
    run.unlockAllTalents();
    homestead.setMaterials({ wood: 99, iron: 99, herbs: 99, food: 99, crystal: 99 });
  }

  const hasUnspentTalents = Object.keys(keywordDefinitions).some((kw) => {
    const kwId = kw as KeywordId;
    const xp = (run.talentXP[kwId] ?? 0) + (run.runTalentXP?.[kwId] ?? 0);
    return getTalentKeywordProgress(xp, (run.unlockedTalents[kwId] ?? []).length).hasUnspent;
  });

  const hasAffordableHomestead = (() => {
    const { materialInventory, constructedBuildings, plantedFarms, completedResearch } = homestead;
    const affordableBuilding = buildings.some((b) => {
      if (constructedBuildings.includes(b.id)) return false;
      return canAfford(materialInventory, b.cost);
    });
    const affordableFarm = farmPlots.some((f) => !plantedFarms.includes(f.id) && canAfford(materialInventory, f.cost));
    const affordableResearch = researchUpgrades.some(
      (r) => !completedResearch.includes(r.id) && canAfford(materialInventory, r.cost),
    );
    return affordableBuilding || affordableFarm || affordableResearch;
  })();

  const battleScreenProps = {
    view: { battleState: run.battleState, heroArt, playerName, isMobileLandscape },
    hover: {
      hoveredCardId: run.hoveredCardId,
      setHoveredCardId: run.setHoveredCardId,
      shimmerState: run.shimmerState,
      onHoverShimmer: run.maybeTriggerShimmer,
    },
    feedback: {
      playerStatusChips: run.playerStatusChips,
      enemyStatusChips: run.enemyStatusChips,
      playerCombatTexts: run.playerCombatTexts,
      enemyCombatTexts: run.enemyCombatTexts,
      cardGhosts: run.cardGhosts,
      playerShaking: run.playerShaking,
      enemyShaking: run.enemyShaking,
      companionShaking: run.companionShaking,
    },
    refs: {
      handCardRefs: run.handCardRefs,
      battleSceneRef: run.battleSceneRef,
      playerPanelRef: run.playerPanelRef,
      enemyPanelRef: run.enemyPanelRef,
    },
    actions: {
      onCardClick: run.handleCardClick,
      onOpenMenu: (rect?: DOMRect) => {
        setMenuAnchorRect(rect ?? null);
        setGameMenuOpen(true);
      },
      onWishChoice: run.handleWishChoice,
      onRemoveCardGhost: run.removeCardGhost,
      onSkipCombatDevMode: run.skipCombatDevMode,
      onEndTurn: run.handleEndTurn,
    },
  };

  const particleColors = SCREEN_PARTICLE_COLORS[renderedScreen];
  const isBossBattle = renderedScreen === "battle" && run.battleState.currentEnemy.enemyType === "boss";
  const particleAlphaMultiplier = isBossBattle ? BOSS_ALPHA_MULTIPLIER : SCREEN_PARTICLE_ALPHA[renderedScreen];

  return (
    <ErrorBoundary>
      {isPortraitMobile ? (
        <div className="flex h-screen w-screen items-center justify-center bg-background p-6 text-center">
          <div>
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <svg
                className="h-8 w-8 text-muted-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 3.75H6.912a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H15M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859M12 3v8.25m0 0-3-3m3 3 3-3"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-foreground">Rotate Your Device</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Alchemy is designed for landscape orientation. Please rotate your device horizontally to play.
            </p>
          </div>
        </div>
      ) : (
        <div
          className={`flex h-screen w-screen items-center justify-center overflow-hidden bg-background ${isMobileLandscape ? "mobile-landscape p-0" : "p-4"}`}
        >
          <div className="relative" style={frameStyle}>
            <div ref={vrStageRef} className="absolute left-0 top-0 overflow-hidden bg-background" style={stageStyle}>
              <BackgroundParticles variant="embers" {...(particleColors ? { colors: particleColors } : {})} {...(particleAlphaMultiplier ? { alphaMultiplier: particleAlphaMultiplier } : {})} />
              {!initialLoadReady ? (
                <StartupLoadingScreen />
              ) : (
                <div
                  key={renderedScreen}
                  className={`${pagePhase === "exit" ? "page-exit" : "page-enter"} h-full w-full overflow-hidden`}
                >
                  {renderedScreen === "menu" ? (
                    <MenuScreen
                      onPlay={run.beginRun}
                      hasActiveBattle={run.hasActiveBattle}
                      hasActiveRun={run.hasActiveRun}
                      onCollection={() => run.goToScreen("collection")}
                      onOptions={() => run.goToScreen("options")}
                      onHomestead={() => run.goToScreen("homestead")}
                      onTalents={() => run.goToScreen("talents")}
                      {...(platform.canQuit ? { onQuit: platform.quit } : {})}
                      logoSrc={menuLogo}
                      isMobileLandscape={isMobileLandscape}
                      hasUnspentTalents={hasUnspentTalents}
                      hasAffordableHomestead={hasAffordableHomestead}
                    />
                  ) : null}
                  {renderedScreen === "character-select" ? (
                    <CharacterSelectScreen
                      onConfirm={run.handleCharacterSelect}
                      onBack={() => run.goToScreen("menu")}
                    />
                  ) : null}
                  {renderedScreen === "battle" ? <BattleScreen {...battleScreenProps} /> : null}
                  {renderedScreen === "rewards" ? (
                    <RewardsScreen
                      rewardType={run.rewardType}
                      rewardChoices={run.rewardChoices}
                      rewardGold={run.rewardGold}
                      rewardMaterials={run.rewardMaterials}
                      hoveredCardId={run.hoveredCardId}
                      onHoverChange={run.setHoveredCardId}
                      shimmerState={run.shimmerState}
                      onHoverShimmer={run.maybeTriggerShimmer}
                      selectedRewardId={run.selectedRewardId}
                      onSelectReward={run.setSelectedRewardId}
                      onAddReward={() => run.finishRewards()}
                      onSkip={() => run.finishRewards()}
                    />
                  ) : null}
                  {renderedScreen === "destination" ? (
                    <DestinationScreen
                      destinationOptions={run.destinationOptions}
                      onChoose={(dest) => run.handleDestinationChoice(dest)}
                      destinationButtonRefs={run.destinationButtonRefs}
                      currentAct={run.currentAct}
                    />
                  ) : null}
                  {renderedScreen === "campfire" ? (
                    <CampfireScreen
                      playerHealth={run.runPlayerHealth}
                      maxHp={run.runMaxHealth}
                      onContinue={run.handleCampfireContinue}
                    />
                  ) : null}
                  {renderedScreen === "shop" ? (
                    <MerchantShopScreen
                      gold={run.runGold}
                      shopCards={run.shopCards}
                      runDeck={run.runDeck}
                      refreshesLeft={run.shopRefreshesLeft}
                      removeUsed={run.shopRemoveUsed}
                      cardPrice={run.shopCardPrice}
                      removePrice={run.shopRemovePrice}
                      refreshPrice={run.shopRefreshPrice}
                      onBuyCard={run.handleShopBuyCard}
                      onRemoveCard={run.handleShopRemoveCard}
                      onRefresh={run.handleShopRefresh}
                      onContinue={run.handleShopContinue}
                    />
                  ) : null}
                  {renderedScreen === "alchemist" ? (
                    <AlchemistShopScreen
                      gold={run.runGold}
                      potionCards={run.alchemistPotions}
                      runDeck={run.runDeck}
                      refreshesLeft={run.alchemistRefreshesLeft}
                      mixUsed={run.alchemistMixUsed}
                      potionPrice={run.alchemistPotionPrice}
                      mixPrice={run.alchemistMixPrice}
                      onBuyCard={run.handleAlchemistBuyCard}
                      onRefresh={run.handleAlchemistRefresh}
                      onMixPotions={run.handleAlchemistMixPotions}
                      onContinue={run.handleAlchemistContinue}
                    />
                  ) : null}
                  {renderedScreen === "mystery" && run.mysteryEvent ? (
                    <MysteryScreen
                      event={run.mysteryEvent}
                      onChoose={run.handleMysteryChoice}
                      onChooseCard={run.handleMysteryChooseCard}
                      onRemoveCard={run.handleMysteryRemoveCard}
                      onContinue={run.handleMysteryContinue}
                      runDeck={run.runDeck}
                      findCard={run.findCard}
                      findTrinket={run.findTrinket}
                      mysteryCardChoices={run.mysteryCardChoices}
                    />
                  ) : null}
                  {renderedScreen === "corruption" ? (
                    <CorruptionScreen
                      runDeck={run.runDeck}
                      result={run.corruptionResult}
                      onCorrupt={run.handleCorruptCard}
                      onLeave={run.handleCorruptionLeave}
                      onContinue={run.handleCorruptionContinue}
                    />
                  ) : null}
                  {renderedScreen === "options" ? (
                    <OptionsScreen
                      navigation={{
                        hasActiveBattle: run.hasActiveBattle,
                        onMainMenu: () => run.goToScreen("menu"),
                        onReturnToBattle: run.returnToBattle,
                      }}
                      display={{
                        selectedResolution,
                        onResolutionChange: setSelectedResolution,
                        displayMode,
                        onDisplayModeChange: setDisplayMode,
                        showDisplayMode: platform.isDesktop,
                        uiScale,
                        onUiScaleChange: setUiScale,
                        brightness,
                        onBrightnessChange: setBrightness,
                      }}
                      audio={{
                        masterVol,
                        musicVol,
                        sfxVol,
                        onMasterVolChange: setMasterVol,
                        onMusicVolChange: setMusicVol,
                        onSfxVolChange: setSfxVol,
                        muteInBackground,
                        onMuteInBackgroundChange: setMuteInBackground,
                      }}
                      gameplay={{
                        autoEndTurn,
                        onAutoEndTurnChange: setAutoEndTurn,
                      }}
                      saveData={{
                        showClearSaveConfirm,
                        onOpenClearSaveConfirm: () => setShowClearSaveConfirm(true),
                        onCloseClearSaveConfirm: () => setShowClearSaveConfirm(false),
                        onConfirmClearSave: clearSaveData,
                        onResetOptions: resetOptionsToDefault,
                      }}
                      dev={{ onUnlockAll: unlockAllDevMode }}
                    />
                  ) : null}
                  {renderedScreen === "collection" ? (
                    <CollectionScreen
                      hasActiveBattle={run.hasActiveBattle}
                      onMainMenu={() => run.goToScreen("menu")}
                      onReturnToBattle={run.returnToBattle}
                      collectionTab={collectionTab}
                      onSelectTab={handleCollectionTabChange}
                      hoveredCardId={run.hoveredCardId}
                      onHoverChange={run.setHoveredCardId}
                      discoveredCardIds={discoveredCardIds}
                      encounteredEnemyIds={encounteredEnemyIds}
                      discoveredTrinketIds={discoveredTrinketIds}
                      collectionPages={collectionPages}
                      onPageChange={setCollectionPage}
                    />
                  ) : null}
                  {renderedScreen === "homestead" ? (
                    <HomesteadScreen
                      materialInventory={homestead.materialInventory}
                      constructedBuildings={homestead.constructedBuildings}
                      plantedFarms={homestead.plantedFarms}
                      completedResearch={homestead.completedResearch}
                      hasActiveBattle={run.hasActiveBattle}
                      onMainMenu={() => run.goToScreen("menu")}
                      onReturnToBattle={run.returnToBattle}
                      onConstructBuilding={homestead.constructBuilding}
                      onPlantFarm={homestead.plantFarm}
                      onCompleteResearch={homestead.completeResearch}
                    />
                  ) : null}
                  {renderedScreen === "talents" ? (
                    <TalentsScreen
                      hasActiveBattle={run.hasActiveBattle}
                      onMainMenu={() => run.goToScreen("menu")}
                      onReturnToBattle={run.returnToBattle}
                      talentXP={run.talentXP}
                      runTalentXP={run.runTalentXP}
                      unlockedTalents={run.unlockedTalents}
                      onUnlockTalent={run.unlockTalent}
                      onResetTalents={run.resetUnlockedTalents}
                    />
                  ) : null}
                  {renderedScreen === "game-over" ? (
                    <GameOverScreen
                      runTalentXP={run.runTalentXP}
                      talentXP={run.talentXP}
                      runEndMaterials={run.runEndMaterials}
                      onMainMenu={() => run.resetRunState()}
                    />
                  ) : null}
                  {renderedScreen === "run-victory" ? (
                    <RunVictoryScreen runEndMaterials={run.runEndMaterials} onMainMenu={() => run.resetRunState()} />
                  ) : null}
                </div>
              )}
              <GameMenu
                isOpen={gameMenuOpen}
                anchorRect={menuAnchorRect}
                onClose={() => {
                  setGameMenuOpen(false);
                  setMenuAnchorRect(null);
                }}
                onMainMenu={() => run.goToScreen("menu")}
                onCollection={() => run.goToScreen("collection")}
                onTalents={() => run.goToScreen("talents")}
                onHomestead={() => run.goToScreen("homestead")}
                onOptions={() => run.goToScreen("options")}
                {...(renderedScreen === "battle" ? { onEndRun: run.handleEndRun } : {})}
              />
            </div>
          </div>
        </div>
      )}
    </ErrorBoundary>
  );
}
