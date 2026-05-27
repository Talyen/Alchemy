// Screen route registry — maps Screen values to screen components.
import { ErrorBoundary } from "@/components/error-boundary";
import type { ReactNode } from "react";
import { platform } from "@/lib/platform";
import { menuLogo, menuLogoVariants, cardLibrary, trinketLibrary } from "@/lib/game-data";
import type { AspectRatioOption, DisplayMode, UiScale } from "@/features/alchemy/types";
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

export function renderAlchemyScreenRoute(ctx: ScreenRouteContext): ReactNode {
  const {
    screen,
    actions: a,
    appValues,
    appActions,
    homesteadValues,
    homesteadActions,
    handCardRefs,
    drawPileRef,
    discardPileRef,
    battleSceneRef,
    playerPanelRef,
    enemyPanelRef,
    heroArt,
    playerName,
    aspectMode,
    stagePixelRatio,
    cardTransfers,
    hiddenHandCardKeys,
    cardTransferInProgress,
    hasUnspentTalents,
    hasAffordableHomestead,
    collectionTab,
    collectionPages,
    encounteredEnemyIds,
    discoveredTrinketIds,
    showClearSaveConfirm,
    pendingCharacterId,
    onOpenBattleMenu,
    onClearSaveData,
    onUnlockAllDevMode,
  } = ctx;
  switch (screen) {
    case "menu":
      return withScreenBoundary(
        "menu",
        <MenuScreen
          onPlay={() => a.goToScreen("game-mode-select")}
          onCollection={() => a.goToScreen("collection")}
          onOptions={() => a.goToScreen("options")}
          onHomestead={() => a.goToScreen("homestead")}
          onTalents={() => a.goToScreen("talents")}
          {...(platform.canQuit ? { onQuit: platform.quit } : {})}
          logoSrc={menuLogo}
          logoSrcVariants={menuLogoVariants}
          hasUnspentTalents={hasUnspentTalents}
          hasAffordableHomestead={hasAffordableHomestead}
        />,
      );
    case "game-mode-select":
      return withScreenBoundary(
        "game-mode-select",
        <GameModeSelectScreen
          onSelectCampaign={a.beginCampaign}
          onSelectLabyrinth={a.beginLabyrinth}
          onSelectWildwood={a.beginWildwood}
          onBack={() => a.goToScreen("menu")}
        />,
      );
    case "character-select":
      return withScreenBoundary(
        "character-select",
        <CharacterSelectScreen onConfirm={a.handleCharacterSelect} onBack={() => a.goToScreen("game-mode-select")} />,
      );
    case "draft-deck":
      return withScreenBoundary("draft-deck", <DraftDeckScreen onComplete={a.handleDraftComplete} />);
    case "difficulty-select":
      return withScreenBoundary(
        "difficulty-select",
        <DifficultySelectScreen
          completedDifficulties={appValues.completedDifficulties[(pendingCharacterId ?? "knight") as CharacterId] ?? []}
          onSelect={a.handleDifficultySelect}
          onBack={a.handleBackFromDifficultySelect}
        />,
      );
    case "battle":
      return withScreenBoundary(
        "battle",
        <BattleScreen
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
          onCardClick={a.handleCardClick}
          onOpenMenu={onOpenBattleMenu}
          onWishChoice={a.handleWishChoice}
          onRemoveCardGhost={a.removeCardGhost}
          onSkipCombatDevMode={a.skipCombatDevMode}
          onEndTurn={a.handleEndTurn}
          cardTransfers={cardTransfers}
          hiddenHandCardKeys={hiddenHandCardKeys}
          cardTransferInProgress={cardTransferInProgress}
        />,
      );
    case "labyrinth-map":
      return withScreenBoundary(
        "labyrinth-map",
        <LabyrinthMapScreen onNodeClick={a.handleLabyrinthNodeEnter} onOpenMenu={onOpenBattleMenu} />,
      );
    case "wildwood-select":
      return withScreenBoundary(
        "wildwood-select",
        <WildwoodSelectScreen onSelect={a.handleWildwoodBossSelect} onBack={() => a.goToScreen("character-select")} />,
      );
    case "rewards":
      return withScreenBoundary("rewards", <RewardsScreen onAddReward={a.finishRewards} onSkip={a.finishRewards} />);
    case "destination":
      return withScreenBoundary("destination", <DestinationScreen onChoose={a.handleDestinationChoice} />);
    case "campfire":
      return withScreenBoundary("campfire", <CampfireScreen onContinue={a.handleCampfireContinue} />);
    case "shop":
      return withScreenBoundary(
        "shop",
        <MerchantShopScreen
          onBuyCard={a.handleShopBuyCard}
          onRemoveCard={a.handleShopRemoveCard}
          onRefresh={a.handleShopRefresh}
          onContinue={a.handleShopContinue}
        />,
      );
    case "alchemist":
      return withScreenBoundary(
        "alchemist",
        <AlchemistShopScreen
          onBuyCard={a.handleAlchemistBuyCard}
          onRefresh={a.handleAlchemistRefresh}
          onMixPotions={a.handleAlchemistMixPotions}
          onContinue={a.handleAlchemistContinue}
        />,
      );
    case "mystery":
      return withScreenBoundary(
        "mystery",
        <MysteryScreen
          onChoose={a.handleMysteryChoice}
          onChooseCard={a.handleMysteryChooseCard}
          onRemoveCard={a.handleMysteryRemoveCard}
          onContinue={a.handleMysteryContinue}
          findCard={(id) => cardLibrary.find((c) => c.id === id)}
          findTrinket={(id) => trinketLibrary.find((t) => t.id === id)}
        />,
      );
    case "corruption":
      return withScreenBoundary(
        "corruption",
        <CorruptionScreen onCorrupt={a.handleCorruptCard} onExit={a.handleCorruptionExit} />,
      );
    case "options":
      return withScreenBoundary(
        "options",
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
            showClearSaveConfirm,
            onOpenClearSaveConfirm: () => appActions.setShowClearSaveConfirm(true),
            onCloseClearSaveConfirm: () => appActions.setShowClearSaveConfirm(false),
            onConfirmClearSave: onClearSaveData,
            onResetOptions: appActions.resetOptionsToDefault,
          }}
          dev={{ onUnlockAll: onUnlockAllDevMode }}
        />,
      );
    case "collection":
      return withScreenBoundary(
        "collection",
        <CollectionScreen
          onOpenMenu={onOpenBattleMenu}
          collectionTab={collectionTab}
          onSelectTab={appActions.handleCollectionTabChange}
          onPageChange={appActions.setCollectionPage}
          bondedCompanions={homesteadValues.bondedCompanions}
          discoveredCardIds={appValues.discoveredCardIds}
          encounteredEnemyIds={encounteredEnemyIds}
          discoveredTrinketIds={discoveredTrinketIds}
          collectionPages={collectionPages}
        />,
      );
    case "homestead":
      return withScreenBoundary(
        "homestead",
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
        />,
      );
    case "talents":
      return withScreenBoundary(
        "talents",
        <TalentsScreen
          onOpenMenu={onOpenBattleMenu}
          onUnlockTalent={a.unlockTalent}
          onResetTalents={a.resetUnlockedTalents}
        />,
      );
    case "game-over":
      return withScreenBoundary("game-over", <GameOverScreen onMainMenu={a.resetRunState} />);
    case "run-victory":
      return withScreenBoundary("run-victory", <RunVictoryScreen onMainMenu={a.resetRunState} />);
    default:
      console.error(`[RenderAlchemyScreen] Unknown screen: "${screen}"`);
      return withScreenBoundary(
        "unknown-screen",
        <div className="flex h-full items-center justify-center">
          <p className="text-muted-foreground">Unknown screen: {screen}</p>
        </div>,
      );
  }
}
