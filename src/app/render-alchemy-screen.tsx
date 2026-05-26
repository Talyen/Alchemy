// Screen route renderer for the root app shell.
// Reads data from Zustand stores instead of the run controller object.
import { ErrorBoundary } from "@/components/error-boundary";
import { platform } from "@/lib/platform";
import { menuLogo, menuLogoVariants, cardLibrary, trinketLibrary } from "@/lib/game-data";
import type { CardTransfer, Screen, Destination, CollectionTab } from "@/features/alchemy/types";
import type { BattleCard, CharacterId, DifficultyId, KeywordId } from "@/lib/game-data";
import type { MysteryChoice } from "@/features/alchemy/mystery-events";
import { useAppStore } from "@/features/alchemy/stores/app-store";
import { useHomesteadStore } from "@/features/alchemy/stores/homestead-store";
import { BattleScreen } from "@/features/alchemy/screens/battle-screen";
import {
  AlchemistShopScreen,
  CampfireScreen,
  CharacterSelectScreen,
  CollectionScreen,
  CorruptionScreen,
  DestinationScreen,
  DifficultySelectScreen,
  DraftDeckScreen,
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

export type ControllerActions = {
  navigateTo: (screen: Screen) => void;
  goToScreen: (screen: Screen) => void;
  beginCampaign: () => void;
  beginLabyrinth: () => void;
  beginWildwood: () => void;
  handleCharacterSelect: (id: CharacterId) => void;
  handleDraftComplete: (draftedCards: BattleCard[]) => void;
  handleDifficultySelect: (id: DifficultyId) => void;
  handleBackFromDifficultySelect: () => void;
  handleWildwoodBossSelect: (id: string) => void;
  handleCardClick: (card: BattleCard, index: number, event: React.MouseEvent<HTMLButtonElement>) => void;
  handleWishChoice: (card: BattleCard) => void;
  handleEndTurn: () => void;
  handleEndRun: () => void;
  skipCombatDevMode: () => void;
  removeCardGhost: (id: string) => void;
  finishRewards: () => void;
  handleDestinationChoice: (dest: Destination) => void;
  handleCampfireContinue: () => void;
  handleShopContinue: () => void;
  handleShopBuyCard: (card: BattleCard) => void | null;
  handleShopRemoveCard: (index: number) => void;
  handleShopRefresh: () => void;
  handleAlchemistBuyCard: (card: BattleCard) => void | null;
  handleAlchemistContinue: () => void;
  handleAlchemistRefresh: () => void;
  handleAlchemistMixPotions: (a: number, b: number) => BattleCard | null;
  handleMysteryChoice: (choice: MysteryChoice) => void;
  handleMysteryChooseCard: (cardId: string) => void;
  handleMysteryRemoveCard: (index: number) => void;
  handleMysteryContinue: () => void;
  handleCorruptCard: (index: number) => void;
  handleCorruptionContinue: () => void;
  handleCorruptionLeave: () => void;
  handleLabyrinthNodeEnter: (row: number, col: number) => void;
  handleLabyrinthEndRun: () => void;
  resetRunState: () => void;
  returnToBattle: () => void;
  unlockTalent: (keywordId: KeywordId, talentId: string) => void;
  resetUnlockedTalents: () => void;
};

type RenderAlchemyScreenProps = {
  screen: Screen;
  actions: ControllerActions;
  handCardRefs: React.MutableRefObject<Record<string, HTMLButtonElement | null>>;
  drawPileRef: React.MutableRefObject<HTMLDivElement | null>;
  discardPileRef: React.MutableRefObject<HTMLDivElement | null>;
  battleSceneRef: React.MutableRefObject<HTMLDivElement | null>;
  playerPanelRef: React.MutableRefObject<HTMLDivElement | null>;
  enemyPanelRef: React.MutableRefObject<HTMLDivElement | null>;
  heroArt: string;
  playerName: string;
  aspectMode: "standard" | "narrow" | "ultrawide";
  stagePixelRatio: number;
  cardTransfers: CardTransfer[];
  hiddenHandCardKeys: Set<string>;
  cardTransferInProgress: boolean;
  hasUnspentTalents: boolean;
  hasAffordableHomestead: boolean;
  collectionTab: CollectionTab;
  collectionPages: Record<CollectionTab, number>;
  encounteredEnemyIds: string[];
  discoveredTrinketIds: string[];
  showClearSaveConfirm: boolean;
  pendingCharacterId: string | null;
  onOpenBattleMenu: (rect?: DOMRect) => void;
  onClearSaveData: () => void;
  onUnlockAllDevMode: () => void;
};

export function renderAlchemyScreen({
  screen,
  actions: a,
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
}: RenderAlchemyScreenProps) {
  const appState = useAppStore.getState();
  switch (screen) {
    case "menu":
      return (
        <ErrorBoundary label="menu">
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
          />
        </ErrorBoundary>
      );
    case "game-mode-select":
      return (
        <ErrorBoundary label="game-mode-select">
          <GameModeSelectScreen
            onSelectCampaign={a.beginCampaign}
            onSelectLabyrinth={a.beginLabyrinth}
            onSelectWildwood={a.beginWildwood}
            onBack={() => a.goToScreen("menu")}
          />
        </ErrorBoundary>
      );
    case "character-select":
      return (
        <ErrorBoundary label="character-select">
          <CharacterSelectScreen onConfirm={a.handleCharacterSelect} onBack={() => a.goToScreen("game-mode-select")} />
        </ErrorBoundary>
      );
    case "draft-deck":
      return (
        <ErrorBoundary label="draft-deck">
          <DraftDeckScreen onComplete={a.handleDraftComplete} />
        </ErrorBoundary>
      );
    case "difficulty-select":
      return (
        <ErrorBoundary label="difficulty-select">
          <DifficultySelectScreen
            completedDifficulties={
              useAppStore.getState().completedDifficulties[(pendingCharacterId ?? "knight") as CharacterId] ?? []
            }
            onSelect={a.handleDifficultySelect}
            onBack={a.handleBackFromDifficultySelect}
          />
        </ErrorBoundary>
      );
    case "battle":
      return (
        <ErrorBoundary label="battle">
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
          />
        </ErrorBoundary>
      );
    case "labyrinth-map":
      return (
        <ErrorBoundary label="labyrinth-map">
          <LabyrinthMapScreen onNodeClick={a.handleLabyrinthNodeEnter} onOpenMenu={onOpenBattleMenu} />
        </ErrorBoundary>
      );
    case "wildwood-select":
      return (
        <ErrorBoundary label="wildwood-select">
          <WildwoodSelectScreen onSelect={a.handleWildwoodBossSelect} onBack={() => a.goToScreen("character-select")} />
        </ErrorBoundary>
      );
    case "rewards":
      return (
        <ErrorBoundary label="rewards">
          <RewardsScreen onAddReward={a.finishRewards} onSkip={a.finishRewards} />
        </ErrorBoundary>
      );
    case "destination":
      return (
        <ErrorBoundary label="destination">
          <DestinationScreen onChoose={a.handleDestinationChoice} />
        </ErrorBoundary>
      );
    case "campfire":
      return (
        <ErrorBoundary label="campfire">
          <CampfireScreen onContinue={a.handleCampfireContinue} />
        </ErrorBoundary>
      );
    case "shop":
      return (
        <ErrorBoundary label="shop">
          <MerchantShopScreen
            onBuyCard={a.handleShopBuyCard}
            onRemoveCard={a.handleShopRemoveCard}
            onRefresh={a.handleShopRefresh}
            onContinue={a.handleShopContinue}
          />
        </ErrorBoundary>
      );
    case "alchemist":
      return (
        <ErrorBoundary label="alchemist">
          <AlchemistShopScreen
            onBuyCard={a.handleAlchemistBuyCard}
            onRefresh={a.handleAlchemistRefresh}
            onMixPotions={a.handleAlchemistMixPotions}
            onContinue={a.handleAlchemistContinue}
          />
        </ErrorBoundary>
      );
    case "mystery":
      return (
        <ErrorBoundary label="mystery">
          <MysteryScreen
            onChoose={a.handleMysteryChoice}
            onChooseCard={a.handleMysteryChooseCard}
            onRemoveCard={a.handleMysteryRemoveCard}
            onContinue={a.handleMysteryContinue}
            findCard={(id) => cardLibrary.find((c) => c.id === id)}
            findTrinket={(id) => trinketLibrary.find((t) => t.id === id)}
          />
        </ErrorBoundary>
      );
    case "corruption":
      return (
        <ErrorBoundary label="corruption">
          <CorruptionScreen
            onCorrupt={a.handleCorruptCard}
            onLeave={a.handleCorruptionLeave}
            onContinue={a.handleCorruptionContinue}
          />
        </ErrorBoundary>
      );
    case "options":
      return (
        <ErrorBoundary label="options">
          <OptionsScreen
            onOpenMenu={onOpenBattleMenu}
            display={{
              selectedAspectRatio: appState.selectedAspectRatio,
              onAspectRatioChange: appState.setSelectedAspectRatio,
              displayMode: appState.displayMode,
              onDisplayModeChange: appState.setDisplayMode,
              showDisplayMode: platform.isDesktop,
              uiScale: appState.uiScale,
              onUiScaleChange: appState.setUiScale,
              brightness: appState.brightness,
              onBrightnessChange: appState.setBrightness,
            }}
            audio={{
              masterVol: appState.masterVol,
              musicVol: appState.musicVol,
              sfxVol: appState.sfxVol,
              onMasterVolChange: appState.setMasterVol,
              onMusicVolChange: appState.setMusicVol,
              onSfxVolChange: appState.setSfxVol,
              muteInBackground: appState.muteInBackground,
              onMuteInBackgroundChange: appState.setMuteInBackground,
            }}
            gameplay={{ autoEndTurn: appState.autoEndTurn, onAutoEndTurnChange: appState.setAutoEndTurn }}
            saveData={{
              showClearSaveConfirm,
              onOpenClearSaveConfirm: () => appState.setShowClearSaveConfirm(true),
              onCloseClearSaveConfirm: () => appState.setShowClearSaveConfirm(false),
              onConfirmClearSave: onClearSaveData,
              onResetOptions: appState.resetOptionsToDefault,
            }}
            dev={{ onUnlockAll: onUnlockAllDevMode }}
          />
        </ErrorBoundary>
      );
    case "collection":
      return (
        <ErrorBoundary label="collection">
          <CollectionScreen
            onOpenMenu={onOpenBattleMenu}
            collectionTab={collectionTab}
            onSelectTab={appState.handleCollectionTabChange}
            onPageChange={appState.setCollectionPage}
            bondedCompanions={useHomesteadStore.getState().bondedCompanions}
            discoveredCardIds={appState.discoveredCardIds}
            encounteredEnemyIds={encounteredEnemyIds}
            discoveredTrinketIds={discoveredTrinketIds}
            collectionPages={collectionPages}
          />
        </ErrorBoundary>
      );
    case "homestead":
      return (
        <ErrorBoundary label="homestead">
          <HomesteadScreen
            onOpenMenu={onOpenBattleMenu}
            materialInventory={useHomesteadStore.getState().materialInventory}
            constructedBuildings={useHomesteadStore.getState().constructedBuildings}
            plantedFarms={useHomesteadStore.getState().plantedFarms}
            completedResearch={useHomesteadStore.getState().completedResearch}
            bondedCompanions={useHomesteadStore.getState().bondedCompanions}
            discoveredCardIds={appState.discoveredCardIds}
            onConstructBuilding={useHomesteadStore.getState().constructBuilding}
            onPlantFarm={useHomesteadStore.getState().plantFarm}
            onCompleteResearch={useHomesteadStore.getState().completeResearch}
            onBondCompanion={useHomesteadStore.getState().bondCompanion}
          />
        </ErrorBoundary>
      );
    case "talents":
      return (
        <ErrorBoundary label="talents">
          <TalentsScreen
            onOpenMenu={onOpenBattleMenu}
            onUnlockTalent={a.unlockTalent}
            onResetTalents={a.resetUnlockedTalents}
          />
        </ErrorBoundary>
      );
    case "game-over":
      return (
        <ErrorBoundary label="game-over">
          <GameOverScreen onMainMenu={a.resetRunState} />
        </ErrorBoundary>
      );
    case "run-victory":
      return (
        <ErrorBoundary label="run-victory">
          <RunVictoryScreen onMainMenu={a.resetRunState} />
        </ErrorBoundary>
      );
    default:
      return null;
  }
}
