// Screen route renderer for the root app shell.
// Keeps the large screen switch and prop adaptation out of App side-effect wiring.
import { platform } from "@/lib/platform";
import { menuLogo } from "@/lib/game-data";
import type { Screen } from "@/features/alchemy/types";
import { BattleScreen } from "@/features/alchemy/screens/battle-screen";
import {
  AlchemistShopScreen,
  CampfireScreen,
  CharacterSelectScreen,
  CollectionScreen,
  CorruptionScreen,
  DestinationScreen,
  DifficultySelectScreen,
  GameModeSelectScreen,
  GameOverScreen,
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
import { HomesteadScreen } from "@/features/alchemy/screens/homestead-screen";
import type { useAlchemyRunController } from "@/features/alchemy/use-alchemy-run-controller";
import type { useHomesteadState } from "@/features/alchemy/use-homestead-state";
import type { useAppSaveState } from "@/app/use-app-save-state";

type RenderAlchemyScreenProps = {
  screen: Screen;
  run: ReturnType<typeof useAlchemyRunController>;
  save: ReturnType<typeof useAppSaveState>;
  homestead: ReturnType<typeof useHomesteadState>;
  heroArt: string;
  playerName: string;
  isMobileLandscape: boolean;
  aspectMode: "standard" | "narrow" | "ultrawide";
  hasUnspentTalents: boolean;
  hasAffordableHomestead: boolean;
  onOpenBattleMenu: (rect?: DOMRect) => void;
  onClearSaveData: () => void;
  onUnlockAllDevMode: () => void;
};

export function renderAlchemyScreen({
  screen,
  run,
  save,
  homestead,
  heroArt,
  playerName,
  isMobileLandscape,
  aspectMode,
  hasUnspentTalents,
  hasAffordableHomestead,
  onOpenBattleMenu,
  onClearSaveData,
  onUnlockAllDevMode,
}: RenderAlchemyScreenProps) {
  switch (screen) {
    case "menu":
      return <MenuScreen
        onPlay={() => run.goToScreen("game-mode-select")}
        onCollection={() => run.goToScreen("collection")}
        onOptions={() => run.goToScreen("options")}
        onHomestead={() => run.goToScreen("homestead")}
        onTalents={() => run.goToScreen("talents")}
        {...(platform.canQuit ? { onQuit: platform.quit } : {})}
        logoSrc={menuLogo}
        isMobileLandscape={isMobileLandscape}
        hasUnspentTalents={hasUnspentTalents}
        hasAffordableHomestead={hasAffordableHomestead}
      />;
    case "game-mode-select":
      return <GameModeSelectScreen
        onSelectCampaign={run.beginCampaign}
        onSelectLabyrinth={run.beginLabyrinth}
        onSelectWildwood={run.beginWildwood}
        hasActiveCampaign={run.hasActiveRun && run.activeRunData?.contentSystemType === "campaign"}
        hasActiveLabyrinth={run.hasActiveRun && run.activeRunData?.contentSystemType === "labyrinth"}
        onBack={() => run.goToScreen("menu")}
      />;
    case "character-select":
      return <CharacterSelectScreen onConfirm={run.handleCharacterSelect} onBack={() => run.goToScreen("menu")} />;
    case "difficulty-select":
      return run.pendingCharacterId ? <DifficultySelectScreen
        characterId={run.pendingCharacterId}
        completedDifficulties={save.completedDifficulties[run.pendingCharacterId] ?? []}
        onSelect={run.handleDifficultySelect}
        onBack={run.handleBackFromDifficultySelect}
      /> : null;
    case "battle":
      return <BattleScreen
        view={{ battleState: run.battleState, heroArt, playerName, isMobileLandscape, aspectMode }}
        hover={{
          hoveredCardId: run.hoveredCardId,
          setHoveredCardId: run.setHoveredCardId,
          shimmerState: run.shimmerState,
          onHoverShimmer: run.maybeTriggerShimmer,
        }}
        feedback={{
          playerStatusChips: run.playerStatusChips,
          enemyStatusChips: run.enemyStatusChips,
          playerCombatTexts: run.playerCombatTexts,
          enemyCombatTexts: run.enemyCombatTexts,
          cardGhosts: run.cardGhosts,
          playerShaking: run.playerShaking,
          enemyShaking: run.enemyShaking,
          companionShaking: run.companionShaking,
          activeLabyrinthModifiers: run.activeLabyrinthModifiers,
        }}
        refs={{
          handCardRefs: run.handCardRefs,
          battleSceneRef: run.battleSceneRef,
          playerPanelRef: run.playerPanelRef,
          enemyPanelRef: run.enemyPanelRef,
        }}
        actions={{
          onCardClick: run.handleCardClick,
          onOpenMenu: onOpenBattleMenu,
          onWishChoice: run.handleWishChoice,
          onRemoveCardGhost: run.removeCardGhost,
          onSkipCombatDevMode: run.skipCombatDevMode,
          onEndTurn: run.handleEndTurn,
        }}
      />;
    case "labyrinth-map":
      return <LabyrinthMapScreen
        labyrinthMap={run.labyrinthMap}
        onNodeClick={run.handleLabyrinthNodeEnter}
        onOpenMenu={onOpenBattleMenu}
      />;
    case "wildwood-select":
      return <WildwoodSelectScreen onSelect={run.handleWildwoodBossSelect} onBack={() => run.goToScreen("menu")} />;
    case "rewards":
      return <RewardsScreen
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
      />;
    case "destination":
      return <DestinationScreen destinationOptions={run.destinationOptions} onChoose={(dest) => run.handleDestinationChoice(dest)} destinationButtonRefs={run.destinationButtonRefs} currentAct={run.currentAct} />;
    case "campfire":
      return <CampfireScreen playerHealth={run.runPlayerHealth} maxHp={run.runMaxHealth} onContinue={run.handleCampfireContinue} />;
    case "shop":
      return <MerchantShopScreen
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
      />;
    case "alchemist":
      return <AlchemistShopScreen
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
      />;
    case "mystery":
      return run.mysteryEvent ? <MysteryScreen
        event={run.mysteryEvent}
        onChoose={run.handleMysteryChoice}
        onChooseCard={run.handleMysteryChooseCard}
        onRemoveCard={run.handleMysteryRemoveCard}
        onContinue={run.handleMysteryContinue}
        runDeck={run.runDeck}
        findCard={run.findCard}
        findTrinket={run.findTrinket}
        mysteryCardChoices={run.mysteryCardChoices}
      /> : null;
    case "corruption":
      return <CorruptionScreen runDeck={run.runDeck} result={run.corruptionResult} onCorrupt={run.handleCorruptCard} onLeave={run.handleCorruptionLeave} onContinue={run.handleCorruptionContinue} />;
    case "options":
      return <OptionsScreen
        navigation={{ hasActiveBattle: run.hasActiveBattle, onMainMenu: () => run.goToScreen("menu"), onReturnToBattle: run.returnToBattle }}
        display={{
          selectedResolution: save.selectedResolution,
          onResolutionChange: save.setSelectedResolution,
          displayMode: save.displayMode,
          onDisplayModeChange: save.setDisplayMode,
          showDisplayMode: platform.isDesktop,
          uiScale: save.uiScale,
          onUiScaleChange: save.setUiScale,
          brightness: save.brightness,
          onBrightnessChange: save.setBrightness,
        }}
        audio={{
          masterVol: save.masterVol,
          musicVol: save.musicVol,
          sfxVol: save.sfxVol,
          onMasterVolChange: save.setMasterVol,
          onMusicVolChange: save.setMusicVol,
          onSfxVolChange: save.setSfxVol,
          muteInBackground: save.muteInBackground,
          onMuteInBackgroundChange: save.setMuteInBackground,
        }}
        gameplay={{ autoEndTurn: save.autoEndTurn, onAutoEndTurnChange: save.setAutoEndTurn }}
        saveData={{
          showClearSaveConfirm: save.showClearSaveConfirm,
          onOpenClearSaveConfirm: () => save.setShowClearSaveConfirm(true),
          onCloseClearSaveConfirm: () => save.setShowClearSaveConfirm(false),
          onConfirmClearSave: onClearSaveData,
          onResetOptions: save.resetOptionsToDefault,
        }}
        dev={{ onUnlockAll: onUnlockAllDevMode }}
      />;
    case "collection":
      return <CollectionScreen
        hasActiveBattle={run.hasActiveBattle}
        onMainMenu={() => run.goToScreen("menu")}
        onReturnToBattle={run.returnToBattle}
        collectionTab={save.collectionTab}
        onSelectTab={save.handleCollectionTabChange}
        hoveredCardId={run.hoveredCardId}
        onHoverChange={run.setHoveredCardId}
        discoveredCardIds={save.discoveredCardIds}
        encounteredEnemyIds={save.encounteredEnemyIds}
        discoveredTrinketIds={save.discoveredTrinketIds}
        collectionPages={save.collectionPages}
        onPageChange={save.setCollectionPage}
        bondedCompanions={homestead.bondedCompanions}
      />;
    case "homestead":
      return <HomesteadScreen
        materialInventory={homestead.materialInventory}
        constructedBuildings={homestead.constructedBuildings}
        plantedFarms={homestead.plantedFarms}
        completedResearch={homestead.completedResearch}
        bondedCompanions={homestead.bondedCompanions}
        discoveredCardIds={save.discoveredCardIds}
        hasActiveBattle={run.hasActiveBattle}
        onMainMenu={() => run.goToScreen("menu")}
        onReturnToBattle={run.returnToBattle}
        onConstructBuilding={homestead.constructBuilding}
        onPlantFarm={homestead.plantFarm}
        onCompleteResearch={homestead.completeResearch}
        onBondCompanion={homestead.bondCompanion}
      />;
    case "talents":
      return <TalentsScreen hasActiveBattle={run.hasActiveBattle} onMainMenu={() => run.goToScreen("menu")} onReturnToBattle={run.returnToBattle} talentXP={run.talentXP} unlockedTalents={run.unlockedTalents} onUnlockTalent={run.unlockTalent} onResetTalents={run.resetUnlockedTalents} />;
    case "game-over":
      return <GameOverScreen runTalentXP={run.runTalentXP} talentXP={run.talentXP} runEndMaterials={run.runEndMaterials} onMainMenu={() => run.resetRunState()} />;
    case "run-victory":
      return <RunVictoryScreen runTalentXP={run.runTalentXP} talentXP={run.talentXP} runEndMaterials={run.runEndMaterials} onMainMenu={() => run.resetRunState()} />;
    default:
      return null;
  }
}
