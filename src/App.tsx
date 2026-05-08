import { useEffect, useRef, useState } from "react";

import {
  alchemistShopBg,
  campfire,
  cardLibrary,
  characterArt,
  eliteEnemyBg,
  enemyBestiary,
  menuLogo,
  merchantShopBg,
  mysteryBg,
  normalEnemyBg,
  pileDiscardArt,
  pileDrawArt,
  trinketLibrary,
} from "@/lib/game-data";
import { playMusic, playMusicImmediate, setMasterVolume, setMusicVolume, setMuted, setSfxVolume, preloadAllSounds } from "@/lib/audio";
import { preloadImages, preloadImagesWhenIdle } from "@/lib/image-preload";
import { MUSIC_KEYS } from "@/lib/game-constants";
import { platform } from "@/lib/platform";

import { useMobileDetection, useVirtualResolution } from "@/features/alchemy/hooks";
import { BattleScreen } from "@/features/alchemy/screens/battle-screen";
import {
  AlchemistHutScreen, CampfireScreen, CharacterSelectScreen, CollectionScreen, DestinationScreen,
  GameOverScreen, MenuScreen, MerchantShopScreen, MysteryScreen, OptionsScreen,
  RewardsScreen, TalentsScreen,
} from "@/features/alchemy/screens";
import {
  clearAlchemySaveData,
  defaultSaveData,
  loadAlchemySaveData,
  saveAlchemySaveData,
} from "@/features/alchemy/storage";
import type { CollectionTab, DisplayMode, ResolutionOption, Screen, UiScale } from "@/features/alchemy/types";
import { useAlchemyRunController } from "@/features/alchemy/use-alchemy-run-controller";

const PAGE_EXIT_MS = 130;

type CollectionPages = Record<CollectionTab, number>;

const initialCollectionPages: CollectionPages = {
  cards: 0,
  bestiary: 0,
  trinkets: 0,
};

export default function App() {
  const initialSaveRef = useRef(loadAlchemySaveData());
  const initialSave = initialSaveRef.current;
  const [selectedResolution, setSelectedResolution] = useState<ResolutionOption>(initialSave.selectedResolution);
  const [displayMode, setDisplayMode] = useState<DisplayMode>(initialSave.displayMode);
  const [uiScale, setUiScale] = useState<UiScale>(initialSave.uiScale);
  const [showClearSaveConfirm, setShowClearSaveConfirm] = useState(false);
  const [collectionTab, setCollectionTab] = useState<CollectionTab>("cards");
  const [collectionPages, setCollectionPages] = useState<CollectionPages>(initialCollectionPages);
  const [discoveredCardIds, setDiscoveredCardIds] = useState<string[]>(initialSave.discoveredCardIds);
  const [encounteredEnemyIds, setEncounteredEnemyIds] = useState<string[]>(initialSave.encounteredEnemyIds);
  const [discoveredTrinketIds, setDiscoveredTrinketIds] = useState<string[]>(initialSave.discoveredTrinketIds);
  const [musicVol, setMusicVol] = useState(initialSave.musicVolume);
  const [sfxVol, setSfxVol] = useState(initialSave.sfxVolume);
  const [masterVol, setMasterVol] = useState(initialSave.masterVolume);
  const [muteInBackground, setMuteInBackground] = useState(initialSave.muteInBackground);
  const [autoEndTurn, setAutoEndTurn] = useState(initialSave.autoEndTurn);
  const [renderedScreen, setRenderedScreen] = useState<Screen>("menu");
  const [pagePhase, setPagePhase] = useState<"enter" | "exit">("enter");
  const pendingScreenRef = useRef(renderedScreen);

  useEffect(() => { setMasterVolume(masterVol / 100); }, [masterVol]);
  useEffect(() => { setMusicVolume(musicVol / 100); }, [musicVol]);
  useEffect(() => { setSfxVolume(sfxVol / 100); }, [sfxVol]);
  useEffect(() => { platform.setDisplayMode(displayMode); }, [displayMode]);
  useEffect(() => { document.documentElement.style.setProperty("--alchemy-ui-scale", String(Number(uiScale) / 100)); }, [uiScale]);
  useEffect(() => {
    function applyBackgroundMute() {
      setMuted(muteInBackground && (document.hidden || !document.hasFocus()));
    }

    applyBackgroundMute();
    document.addEventListener("visibilitychange", applyBackgroundMute);
    window.addEventListener("blur", applyBackgroundMute);
    window.addEventListener("focus", applyBackgroundMute);
    return () => {
      document.removeEventListener("visibilitychange", applyBackgroundMute);
      window.removeEventListener("blur", applyBackgroundMute);
      window.removeEventListener("focus", applyBackgroundMute);
      setMuted(false);
    };
  }, [muteInBackground]);
  useEffect(() => {
    preloadAllSounds();
    preloadImagesWhenIdle([
      menuLogo,
      ...Object.values(characterArt).flatMap((entry) => Object.values(entry)),
      pileDrawArt,
      pileDiscardArt,
      normalEnemyBg,
      eliteEnemyBg,
      merchantShopBg,
      alchemistShopBg,
      mysteryBg,
      campfire,
    ]);
  }, []);

  const { isMobileLandscape, isPortraitMobile } = useMobileDetection();
  const { frameStyle, stageStyle } = useVirtualResolution(selectedResolution, isMobileLandscape);
  const run = useAlchemyRunController({ discoveredCardIds, setDiscoveredCardIds, setEncounteredEnemyIds, discoveredTrinketIds, setDiscoveredTrinketIds, initialTalentXP: initialSave.talentXP, initialUnlockedTalents: initialSave.unlockedTalents, initialActiveRun: initialSave.activeRun, autoEndTurn });
  const musicStartedRef = useRef(false);
  useEffect(() => {
    const key = run.screen === "battle" ? MUSIC_KEYS.BATTLE : MUSIC_KEYS.MENU;
    if (!musicStartedRef.current) {
      musicStartedRef.current = true;
      playMusicImmediate(key);
    } else {
      playMusic(key);
    }
  }, [run.screen]);
  const currentCollectionPage = collectionPages[collectionTab];
  const heroArt = characterArt[run.characterId]?.[run.characterGender] ?? characterArt.knight.female;

  useEffect(() => {
    if (run.screen === renderedScreen) return;
    pendingScreenRef.current = run.screen;
    setPagePhase("exit");
    const timeout = window.setTimeout(() => {
      setRenderedScreen(pendingScreenRef.current);
      setPagePhase("enter");
    }, PAGE_EXIT_MS);
    return () => window.clearTimeout(timeout);
  }, [run.screen, renderedScreen]);

  useEffect(() => {
    const priorityImages = [heroArt];
    if (run.screen === "battle") {
      priorityImages.push(run.battleState.currentEnemy.art, pileDrawArt, pileDiscardArt, ...run.battleState.hand.map((card) => card.art));
    }
    if (run.screen === "rewards") priorityImages.push(...run.rewardChoices.map((card) => card.art));
    if (run.screen === "shop") priorityImages.push(...run.shopCards.map((card) => card.art));
    if (run.screen === "alchemist") priorityImages.push(...run.alchemistPotions.map((card) => card.art));
    if (run.screen === "mystery" && run.mysteryEvent?.art) priorityImages.push(run.mysteryEvent.art);
    preloadImages(priorityImages);
  }, [heroArt, run.screen, run.battleState.currentEnemy.art, run.battleState.hand, run.rewardChoices, run.shopCards, run.alchemistPotions, run.mysteryEvent]);

  useEffect(() => {
    saveAlchemySaveData({
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
      activeRun: run.activeRunData,
    });
  }, [selectedResolution, displayMode, uiScale, discoveredCardIds, encounteredEnemyIds, discoveredTrinketIds, run.talentXP, run.unlockedTalents, musicVol, sfxVol, masterVol, muteInBackground, autoEndTurn, run.activeRunData]);

  function handleCollectionTabChange(nextTab: CollectionTab) {
    setCollectionTab(nextTab);
    setCollectionPages((current) => ({ ...current, [nextTab]: current[nextTab] ?? 0 }));
  }

  function setCollectionPage(page: number) {
    setCollectionPages((current) => ({ ...current, [collectionTab]: Math.max(0, page) }));
  }

  function clearSaveData() {
    clearAlchemySaveData();
    resetOptionsToDefault();
    setDiscoveredCardIds(defaultSaveData.discoveredCardIds);
    setEncounteredEnemyIds(defaultSaveData.encounteredEnemyIds);
    setDiscoveredTrinketIds(defaultSaveData.discoveredTrinketIds);
    setCollectionPages(initialCollectionPages);
    setCollectionTab("cards");
    setShowClearSaveConfirm(false);
    run.resetRunState();
    run.clearPermanentData();
  }

  function resetOptionsToDefault() {
    setSelectedResolution(defaultSaveData.selectedResolution);
    setDisplayMode(defaultSaveData.displayMode);
    setUiScale(defaultSaveData.uiScale);
    setMasterVol(defaultSaveData.masterVolume);
    setMusicVol(defaultSaveData.musicVolume);
    setSfxVol(defaultSaveData.sfxVolume);
    setMuteInBackground(defaultSaveData.muteInBackground);
    setAutoEndTurn(defaultSaveData.autoEndTurn);
  }

  function unlockAllDevMode() {
    setDiscoveredCardIds(cardLibrary.map((card) => card.id));
    setEncounteredEnemyIds(enemyBestiary.map((enemy) => enemy.id));
    setDiscoveredTrinketIds(trinketLibrary.map((trinket) => trinket.id));
    run.unlockAllTalents();
  }

  if (isPortraitMobile) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background p-6 text-center">
        <div>
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <svg className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 3.75H6.912a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H15M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859M12 3v8.25m0 0-3-3m3 3 3-3" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Rotate Your Device</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Alchemy is designed for landscape orientation. Please rotate your device horizontally to play.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-screen w-screen items-center justify-center overflow-hidden bg-background ${isMobileLandscape ? "p-0" : "p-4"}`}>
      <div className="relative" style={frameStyle}>
        <div className="absolute left-0 top-0 overflow-hidden bg-background" style={stageStyle}>
          <div key={renderedScreen} className={`${pagePhase === "exit" ? "page-exit" : "page-enter"} h-full w-full overflow-hidden`}>
          {renderedScreen === "menu" ? <MenuScreen onPlay={run.beginRun} hasActiveBattle={run.hasActiveBattle} onCollection={() => run.goToScreen("collection")} onOptions={() => run.goToScreen("options")} onTalents={() => run.goToScreen("talents")} onQuit={platform.canQuit ? platform.quit : undefined} logoSrc={menuLogo} /> : null}
          {renderedScreen === "character-select" ? <CharacterSelectScreen onConfirm={run.handleCharacterSelect} onBack={() => run.goToScreen("menu")} /> : null}
          {renderedScreen === "battle" ? <BattleScreen battleState={run.battleState} heroArt={heroArt} hoveredCardId={run.hoveredCardId} setHoveredCardId={run.setHoveredCardId} shimmerState={run.shimmerState} onHoverShimmer={run.maybeTriggerShimmer} playerStatusChips={run.playerStatusChips} enemyStatusChips={run.enemyStatusChips} playerCombatTexts={run.playerCombatTexts} enemyCombatTexts={run.enemyCombatTexts} handCardRefs={run.handCardRefs} onCardClick={run.handleCardClick} menuOpen={run.menuOpen} setMenuOpen={run.setMenuOpen} onGoToScreen={run.goToScreen} onWishChoice={run.handleWishChoice} cardGhosts={run.cardGhosts} onRemoveCardGhost={run.removeCardGhost} onSkipCombatDevMode={run.skipCombatDevMode} onEndTurn={run.handleEndTurn} onEndRun={run.handleEndRun} battleSceneRef={run.battleSceneRef} playerPanelRef={run.playerPanelRef} enemyPanelRef={run.enemyPanelRef} playerShaking={run.playerShaking} enemyShaking={run.enemyShaking} companionShaking={run.companionShaking} isMobileLandscape={isMobileLandscape} /> : null}
          {renderedScreen === "rewards" ? <RewardsScreen rewardChoices={run.rewardChoices} rewardGold={run.rewardGold} hoveredCardId={run.hoveredCardId} onHoverChange={run.setHoveredCardId} shimmerState={run.shimmerState} onHoverShimmer={run.maybeTriggerShimmer} selectedRewardId={run.selectedRewardId} onSelectReward={run.setSelectedRewardId} onAddCard={() => { const chosen = run.rewardChoices.find((card) => card.id === run.selectedRewardId); if (chosen) { run.finishRewards(chosen); } }} onSkip={() => run.finishRewards()} /> : null}
          {renderedScreen === "destination" ? <DestinationScreen destinationOptions={run.destinationOptions} onChoose={(dest) => run.handleDestinationChoice(dest)} destinationButtonRefs={run.destinationButtonRefs} /> : null}
          {renderedScreen === "campfire" ? <CampfireScreen playerHealth={run.runPlayerHealth} maxHp={run.runMaxHealth} onContinue={run.handleCampfireContinue} /> : null}
          {renderedScreen === "shop" ? <MerchantShopScreen gold={run.runGold} shopCards={run.shopCards} runDeck={run.runDeck} refreshesLeft={run.shopRefreshesLeft} removeUsed={run.shopRemoveUsed} onBuyCard={run.handleShopBuyCard} onRemoveCard={run.handleShopRemoveCard} onRefresh={run.handleShopRefresh} onContinue={run.handleShopContinue} /> : null}
          {renderedScreen === "alchemist" ? <AlchemistHutScreen gold={run.runGold} potionCards={run.alchemistPotions} runDeck={run.runDeck} refreshesLeft={run.alchemistRefreshesLeft} mixUsed={run.alchemistMixUsed} onBuyCard={run.handleAlchemistBuyCard} onRefresh={run.handleAlchemistRefresh} onMixPotions={run.handleAlchemistMixPotions} onContinue={run.handleAlchemistContinue} /> : null}
          {renderedScreen === "mystery" && run.mysteryEvent ? <MysteryScreen event={run.mysteryEvent} onChoose={run.handleMysteryChoice} onRemoveCard={run.handleMysteryRemoveCard} onContinue={run.handleMysteryContinue} runDeck={run.runDeck} findCard={run.findCard} /> : null}
          {renderedScreen === "options" ? <OptionsScreen hasActiveBattle={run.hasActiveBattle} onMainMenu={() => run.goToScreen("menu")} onReturnToBattle={run.returnToBattle} selectedResolution={selectedResolution} onResolutionChange={setSelectedResolution} displayMode={displayMode} onDisplayModeChange={setDisplayMode} showDisplayMode={platform.isDesktop} uiScale={uiScale} onUiScaleChange={setUiScale} masterVol={masterVol} musicVol={musicVol} sfxVol={sfxVol} onMasterVolChange={setMasterVol} onMusicVolChange={setMusicVol} onSfxVolChange={setSfxVol} muteInBackground={muteInBackground} onMuteInBackgroundChange={setMuteInBackground} autoEndTurn={autoEndTurn} onAutoEndTurnChange={setAutoEndTurn} onResetOptions={resetOptionsToDefault} showClearSaveConfirm={showClearSaveConfirm} onOpenClearSaveConfirm={() => setShowClearSaveConfirm(true)} onCloseClearSaveConfirm={() => setShowClearSaveConfirm(false)} onConfirmClearSave={clearSaveData} onUnlockAll={unlockAllDevMode} /> : null}
          {renderedScreen === "collection" ? <CollectionScreen hasActiveBattle={run.hasActiveBattle} onMainMenu={() => run.goToScreen("menu")} onReturnToBattle={run.returnToBattle} collectionTab={collectionTab} onSelectTab={handleCollectionTabChange} hoveredCardId={run.hoveredCardId} onHoverChange={run.setHoveredCardId} discoveredCardIds={discoveredCardIds} encounteredEnemyIds={encounteredEnemyIds} discoveredTrinketIds={discoveredTrinketIds} page={currentCollectionPage} onPageChange={setCollectionPage} /> : null}
          {renderedScreen === "talents" ? <TalentsScreen hasActiveBattle={run.hasActiveBattle} onMainMenu={() => run.goToScreen("menu")} onReturnToBattle={run.returnToBattle} talentXP={run.talentXP} runTalentXP={run.runTalentXP} unlockedTalents={run.unlockedTalents} onUnlockTalent={run.unlockTalent} onResetTalents={run.resetUnlockedTalents} /> : null}
          {renderedScreen === "game-over" ? <GameOverScreen runTalentXP={run.runTalentXP} talentXP={run.talentXP} onMainMenu={() => run.resetRunState()} /> : null}
          </div>
        </div>
      </div>
    </div>
  );

}
