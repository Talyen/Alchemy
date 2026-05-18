// Screen route renderer for the root app shell.
// Reads data from Zustand stores instead of the run controller object.
import { platform } from "@/lib/platform";
import { menuLogo, cardLibrary, trinketLibrary } from "@/lib/game-data";
import type { Screen, Destination, CollectionTab } from "@/features/alchemy/types";
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
  handleActComplete: () => void;
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
  battleSceneRef: React.MutableRefObject<HTMLDivElement | null>;
  playerPanelRef: React.MutableRefObject<HTMLDivElement | null>;
  enemyPanelRef: React.MutableRefObject<HTMLDivElement | null>;
  heroArt: string;
  playerName: string;
  isMobileLandscape: boolean;
  aspectMode: "standard" | "narrow" | "ultrawide";
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
  battleSceneRef,
  playerPanelRef,
  enemyPanelRef,
  heroArt,
  playerName,
  isMobileLandscape,
  aspectMode,
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
        <MenuScreen
          onPlay={() => a.goToScreen("game-mode-select")}
          onCollection={() => a.goToScreen("collection")}
          onOptions={() => a.goToScreen("options")}
          onHomestead={() => a.goToScreen("homestead")}
          onTalents={() => a.goToScreen("talents")}
          {...(platform.canQuit ? { onQuit: platform.quit } : {})}
          logoSrc={menuLogo}
          isMobileLandscape={isMobileLandscape}
          hasUnspentTalents={hasUnspentTalents}
          hasAffordableHomestead={hasAffordableHomestead}
        />
      );
    case "game-mode-select":
      return (
        <GameModeSelectScreen
          onSelectCampaign={a.beginCampaign}
          onSelectLabyrinth={a.beginLabyrinth}
          onSelectWildwood={a.beginWildwood}
          onBack={() => a.goToScreen("menu")}
        />
      );
    case "character-select":
      return (
        <CharacterSelectScreen onConfirm={a.handleCharacterSelect} onBack={() => a.goToScreen("game-mode-select")} />
      );
    case "difficulty-select":
      return (
        <DifficultySelectScreen
          completedDifficulties={
            useAppStore.getState().completedDifficulties[(pendingCharacterId ?? "knight") as CharacterId] ?? []
          }
          onSelect={a.handleDifficultySelect}
          onBack={a.handleBackFromDifficultySelect}
        />
      );
    case "battle":
      return (
        <BattleScreen
          heroArt={heroArt}
          playerName={playerName}
          isMobileLandscape={isMobileLandscape}
          aspectMode={aspectMode}
          handCardRefs={handCardRefs}
          battleSceneRef={battleSceneRef}
          playerPanelRef={playerPanelRef}
          enemyPanelRef={enemyPanelRef}
          onCardClick={a.handleCardClick}
          onOpenMenu={onOpenBattleMenu}
          onWishChoice={a.handleWishChoice}
          onRemoveCardGhost={a.removeCardGhost}
          onSkipCombatDevMode={a.skipCombatDevMode}
          onEndTurn={a.handleEndTurn}
        />
      );
    case "labyrinth-map":
      return <LabyrinthMapScreen onNodeClick={a.handleLabyrinthNodeEnter} onOpenMenu={onOpenBattleMenu} />;
    case "wildwood-select":
      return (
        <WildwoodSelectScreen onSelect={a.handleWildwoodBossSelect} onBack={() => a.goToScreen("character-select")} />
      );
    case "rewards":
      return <RewardsScreen onAddReward={a.finishRewards} onSkip={a.finishRewards} />;
    case "destination":
      return <DestinationScreen onChoose={a.handleDestinationChoice} />;
    case "campfire":
      return <CampfireScreen onContinue={a.handleCampfireContinue} />;
    case "shop":
      return (
        <MerchantShopScreen
          onBuyCard={a.handleShopBuyCard}
          onRemoveCard={a.handleShopRemoveCard}
          onRefresh={a.handleShopRefresh}
          onContinue={a.handleShopContinue}
        />
      );
    case "alchemist":
      return (
        <AlchemistShopScreen
          onBuyCard={a.handleAlchemistBuyCard}
          onRefresh={a.handleAlchemistRefresh}
          onMixPotions={a.handleAlchemistMixPotions}
          onContinue={a.handleAlchemistContinue}
        />
      );
    case "mystery":
      return (
        <MysteryScreen
          onChoose={a.handleMysteryChoice}
          onChooseCard={a.handleMysteryChooseCard}
          onRemoveCard={a.handleMysteryRemoveCard}
          onContinue={a.handleMysteryContinue}
          findCard={(id) => cardLibrary.find((c) => c.id === id)}
          findTrinket={(id) => trinketLibrary.find((t) => t.id === id)}
        />
      );
    case "corruption":
      return (
        <CorruptionScreen
          onCorrupt={a.handleCorruptCard}
          onLeave={a.handleCorruptionLeave}
          onContinue={a.handleCorruptionContinue}
        />
      );
    case "options":
      return (
        <OptionsScreen
          navigation={{
            onMainMenu: () => a.goToScreen("menu"),
            onReturnToBattle: a.returnToBattle,
          }}
          display={{
            selectedResolution: appState.selectedResolution,
            onResolutionChange: appState.setSelectedResolution,
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
      );
    case "collection":
      return (
        <CollectionScreen
          onMainMenu={() => a.goToScreen("menu")}
          onReturnToBattle={a.returnToBattle}
          collectionTab={collectionTab}
          onSelectTab={appState.handleCollectionTabChange}
          onPageChange={appState.setCollectionPage}
          bondedCompanions={useHomesteadStore.getState().bondedCompanions}
          discoveredCardIds={appState.discoveredCardIds}
          encounteredEnemyIds={encounteredEnemyIds}
          discoveredTrinketIds={discoveredTrinketIds}
          collectionPages={collectionPages}
        />
      );
    case "homestead":
      return (
        <HomesteadScreen
          onMainMenu={() => a.goToScreen("menu")}
          onReturnToBattle={a.returnToBattle}
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
      );
    case "talents":
      return (
        <TalentsScreen
          onMainMenu={() => a.goToScreen("menu")}
          onReturnToBattle={a.returnToBattle}
          onUnlockTalent={a.unlockTalent}
          onResetTalents={a.resetUnlockedTalents}
        />
      );
    case "game-over":
      return <GameOverScreen onMainMenu={a.resetRunState} />;
    case "run-victory":
      return <RunVictoryScreen onMainMenu={a.resetRunState} />;
    default:
      return null;
  }
}
