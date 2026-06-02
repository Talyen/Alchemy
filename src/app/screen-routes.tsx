// Screen route registry — maps Screen values to screen components.
import { ErrorBoundary } from "@/components/error-boundary";
import type { ReactNode } from "react";
import { platform } from "@/lib/platform";
import { menuLogo, menuLogoVariants, cardLibrary, trinketLibrary } from "@/lib/game-data";
import type { AspectRatioOption, CollectionTab, DisplayMode, UiScale, Screen } from "@/features/alchemy/types";
import type { CharacterId, DifficultyId } from "@/lib/game-data";
import type { RenderAlchemyScreenProps } from "@/app/render-screen-props";
import { useAppStore } from "@/features/alchemy/stores/app-store";
import { useHomesteadStore } from "@/features/alchemy/stores/homestead-store";
import {
  AlchemistShopScreen,
  BattleScreen,
  CampfireScreen,
  CharacterSelectScreen,
  CollectionScreen,
  CorruptionScreen,
  DestinationScreen,
  DifficultySelectScreen,
  DraftDeckScreen,
  GameModeSelectScreen,
  GameOverScreen,
  HomesteadScreen,
  LabyrinthMapScreen,
  MenuScreen,
  MerchantShopScreen,
  MysteryScreen,
  OptionsScreen,
  RewardsScreen,
  RunVictoryScreen,
  TalentsScreen,
  WildwoodSelectScreen,
} from "@/features/alchemy/screens";

function withScreenBoundary(label: string, children: ReactNode) {
  return <ErrorBoundary label={label}>{children}</ErrorBoundary>;
}

export type ScreenRouteContext = RenderAlchemyScreenProps & {
  appValues: {
    selectedAspectRatio: AspectRatioOption;
    displayMode: DisplayMode;
    uiScale: UiScale;
    brightness: number;
    masterVol: number;
    musicVol: number;
    sfxVol: number;
    muteInBackground: boolean;
    autoEndTurn: boolean;
    discoveredCardIds: string[];
    completedDifficulties: Record<string, DifficultyId[]>;
    collectionTab: CollectionTab;
    collectionPages: Record<CollectionTab, number>;
    encounteredEnemyIds: string[];
    discoveredTrinketIds: string[];
    showClearSaveConfirm: boolean;
  };
  appActions: ReturnType<typeof useAppStore.getState>;
  homesteadValues: {
    materialInventory: import("@/lib/homestead/types").MaterialInventory;
    constructedBuildings: Record<string, number>;
    plantedFarms: Record<string, number>;
    completedResearch: Record<string, number>;
    bondedCompanions: Record<string, number>;
  };
  homesteadActions: ReturnType<typeof useHomesteadStore.getState>;
};

function buildOptionsScreen(ctx: ScreenRouteContext) {
  const { appValues, appActions, onOpenBattleMenu, onClearSaveData, onUnlockAllDevMode } = ctx;
  return (
    <OptionsScreen
      onOpenMenu={onOpenBattleMenu}
      display={{
        selectedAspectRatio: appValues.selectedAspectRatio,
        onAspectRatioChange: appActions.setSelectedAspectRatio,
        displayMode: appValues.displayMode,
        onDisplayModeChange: appActions.setDisplayMode,
        showDisplayMode: platform.isDesktop,
        uiScale: appValues.uiScale,
        onUiScaleChange: appActions.setUiScale,
        brightness: appValues.brightness,
        onBrightnessChange: appActions.setBrightness,
      }}
      audio={{
        masterVol: appValues.masterVol,
        musicVol: appValues.musicVol,
        sfxVol: appValues.sfxVol,
        onMasterVolChange: appActions.setMasterVol,
        onMusicVolChange: appActions.setMusicVol,
        onSfxVolChange: appActions.setSfxVol,
        muteInBackground: appValues.muteInBackground,
        onMuteInBackgroundChange: appActions.setMuteInBackground,
      }}
      gameplay={{ autoEndTurn: appValues.autoEndTurn, onAutoEndTurnChange: appActions.setAutoEndTurn }}
      saveData={{
        showClearSaveConfirm: appValues.showClearSaveConfirm,
        onOpenClearSaveConfirm: () => appActions.setShowClearSaveConfirm(true),
        onCloseClearSaveConfirm: () => appActions.setShowClearSaveConfirm(false),
        onConfirmClearSave: onClearSaveData,
        onResetOptions: appActions.resetOptionsToDefault,
      }}
      dev={{ onUnlockAll: onUnlockAllDevMode }}
    />
  );
}

const SCREEN_ROUTES: Record<Screen, (ctx: ScreenRouteContext) => ReactNode> = {
  menu: ({ actions: a, hasUnspentTalents, hasAffordableHomestead }) => (
    <MenuScreen
      onPlay={() => a.navigation.goToScreen("game-mode-select")}
      onCollection={() => a.navigation.goToScreen("collection")}
      onOptions={() => a.navigation.goToScreen("options")}
      onHomestead={() => a.navigation.goToScreen("homestead")}
      onTalents={() => a.navigation.goToScreen("talents")}
      {...(platform.canQuit ? { onQuit: platform.quit } : {})}
      logoSrc={menuLogo}
      logoSrcVariants={menuLogoVariants}
      hasUnspentTalents={hasUnspentTalents}
      hasAffordableHomestead={hasAffordableHomestead}
    />
  ),
  "game-mode-select": ({ actions: a }) => (
    <GameModeSelectScreen
      onSelectCampaign={a.runStart.beginCampaign}
      onSelectLabyrinth={a.runStart.beginLabyrinth}
      onSelectWildwood={a.runStart.beginWildwood}
      onBack={() => a.navigation.goToScreen("menu")}
    />
  ),
  "character-select": ({ actions: a }) => (
    <CharacterSelectScreen
      onConfirm={a.runStart.handleCharacterSelect}
      onBack={() => a.navigation.goToScreen("game-mode-select")}
    />
  ),
  "draft-deck": ({ actions: a }) => <DraftDeckScreen onComplete={a.runStart.handleDraftComplete} />,
  "difficulty-select": ({ actions: a, appValues, pendingCharacterId }) => (
    <DifficultySelectScreen
      completedDifficulties={appValues.completedDifficulties[(pendingCharacterId ?? "knight") as CharacterId] ?? []}
      onSelect={a.runStart.handleDifficultySelect}
      onBack={a.runStart.handleBackFromDifficultySelect}
    />
  ),
  battle: ({
    actions: a,
    heroArt,
    playerName,
    aspectMode,
    stagePixelRatio,
    handCardRefs,
    drawPileRef,
    discardPileRef,
    battleSceneRef,
    playerPanelRef,
    enemyPanelRef,
    onOpenBattleMenu,
    cardTransfers,
    hiddenHandCardKeys,
    cardTransferInProgress,
    playableHandCardKeys,
    battleScreenData,
  }) => (
    <BattleScreen
      battleScreenData={battleScreenData}
      heroArt={heroArt}
      playerName={playerName}
      aspectMode={aspectMode}
      stagePixelRatio={stagePixelRatio}
      handCardRefs={handCardRefs}
      drawPileRef={drawPileRef}
      discardPileRef={discardPileRef}
      battleSceneRef={battleSceneRef}
      playerPanelRef={playerPanelRef}
      enemyPanelRef={enemyPanelRef}
      onCardClick={a.battle.handleCardClick}
      onOpenMenu={onOpenBattleMenu}
      onWishChoice={a.battle.handleWishChoice}
      onRemoveCardGhost={a.battle.removeCardGhost}
      onSkipCombatDevMode={a.battle.skipCombatDevMode}
      onEndTurn={a.battle.handleEndTurn}
      cardTransfers={cardTransfers}
      hiddenHandCardKeys={hiddenHandCardKeys}
      cardTransferInProgress={cardTransferInProgress}
      playableHandCardKeys={playableHandCardKeys}
    />
  ),
  "labyrinth-map": ({ actions: a, onOpenBattleMenu }) => (
    <LabyrinthMapScreen onNodeClick={a.runFlow.handleLabyrinthNodeEnter} onOpenMenu={onOpenBattleMenu} />
  ),
  "wildwood-select": ({ actions: a }) => (
    <WildwoodSelectScreen
      onSelect={a.runStart.handleWildwoodBossSelect}
      onBack={() => a.navigation.goToScreen("character-select")}
    />
  ),
  rewards: ({ actions: a }) => (
    <RewardsScreen
      onAddReward={a.runFlow.finishRewards}
      onSkip={a.runFlow.finishRewards}
      onSelectReward={a.runFlow.selectRewardChoice}
    />
  ),
  destination: ({ actions: a }) => (
    <DestinationScreen onChoose={a.runFlow.handleDestinationChoice} onPrepare={a.runFlow.prepareDestinationScreen} />
  ),
  campfire: ({ actions: a }) => <CampfireScreen onContinue={a.runFlow.handleCampfireContinue} />,
  shop: ({ actions: a }) => (
    <MerchantShopScreen
      onBuyCard={a.runFlow.handleShopBuyCard}
      onRemoveCard={a.runFlow.handleShopRemoveCard}
      onRefresh={a.runFlow.handleShopRefresh}
      onContinue={a.runFlow.handleShopContinue}
    />
  ),
  alchemist: ({ actions: a }) => (
    <AlchemistShopScreen
      onBuyCard={a.runFlow.handleAlchemistBuyCard}
      onRefresh={a.runFlow.handleAlchemistRefresh}
      onMixPotions={a.runFlow.handleAlchemistMixPotions}
      onContinue={a.runFlow.handleAlchemistContinue}
    />
  ),
  mystery: ({ actions: a }) => (
    <MysteryScreen
      onChoose={a.runFlow.handleMysteryChoice}
      onChooseCard={a.runFlow.handleMysteryChooseCard}
      onRemoveCard={a.runFlow.handleMysteryRemoveCard}
      onContinue={a.runFlow.handleMysteryContinue}
      findCard={(id) => cardLibrary.find((c) => c.id === id)}
      findTrinket={(id) => trinketLibrary.find((t) => t.id === id)}
    />
  ),
  corruption: ({ actions: a }) => (
    <CorruptionScreen onCorrupt={a.runFlow.handleCorruptCard} onExit={a.runFlow.handleCorruptionExit} />
  ),
  options: buildOptionsScreen,
  collection: ({ appValues, appActions, homesteadValues, onOpenBattleMenu }) => (
    <CollectionScreen
      onOpenMenu={onOpenBattleMenu}
      collectionTab={appValues.collectionTab}
      onSelectTab={appActions.handleCollectionTabChange}
      onPageChange={appActions.setCollectionPage}
      bondedCompanions={homesteadValues.bondedCompanions}
      discoveredCardIds={appValues.discoveredCardIds}
      encounteredEnemyIds={appValues.encounteredEnemyIds}
      discoveredTrinketIds={appValues.discoveredTrinketIds}
      collectionPages={appValues.collectionPages}
    />
  ),
  homestead: ({ appValues, homesteadValues, homesteadActions, onOpenBattleMenu }) => (
    <HomesteadScreen
      onOpenMenu={onOpenBattleMenu}
      materialInventory={homesteadValues.materialInventory}
      constructedBuildings={homesteadValues.constructedBuildings}
      plantedFarms={homesteadValues.plantedFarms}
      completedResearch={homesteadValues.completedResearch}
      bondedCompanions={homesteadValues.bondedCompanions}
      discoveredCardIds={appValues.discoveredCardIds}
      onConstructBuilding={homesteadActions.constructBuilding}
      onPlantFarm={homesteadActions.plantFarm}
      onCompleteResearch={homesteadActions.completeResearch}
      onBondCompanion={homesteadActions.bondCompanion}
    />
  ),
  talents: ({ actions: a, onOpenBattleMenu }) => (
    <TalentsScreen
      onOpenMenu={onOpenBattleMenu}
      onUnlockTalent={a.meta.unlockTalent}
      onResetTalents={a.meta.resetUnlockedTalents}
    />
  ),
  "game-over": ({ actions: a }) => <GameOverScreen onMainMenu={a.runFlow.resetRunState} />,
  "run-victory": ({ actions: a }) => <RunVictoryScreen onMainMenu={a.runFlow.resetRunState} />,
};

export function renderAlchemyScreenRoute(ctx: ScreenRouteContext): ReactNode {
  const render = SCREEN_ROUTES[ctx.screen];
  if (!render) {
    console.error(`[RenderAlchemyScreen] Unknown screen: "${ctx.screen}"`);
    return withScreenBoundary(
      "unknown-screen",
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Unknown screen: {ctx.screen}</p>
      </div>,
    );
  }
  return withScreenBoundary(ctx.screen, render(ctx));
}
