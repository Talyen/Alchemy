// Screen route renderer for the root app shell.
// Reads data from Zustand stores instead of the run controller object.
import { useShallow } from "zustand/react/shallow";
import { renderAlchemyScreenRoute } from "@/app/screen-routes";
import type { RenderAlchemyScreenProps } from "@/app/render-screen-props";
import { useAppStore } from "@/features/alchemy/stores/app-store";
import { useHomesteadStore } from "@/features/alchemy/stores/homestead-store";
import { useAppActions, useHomesteadActions } from "@/features/alchemy/stores/store-actions";
import { useRunScreenData } from "@/features/alchemy/stores/use-run-screen-data";

export type { RenderAlchemyScreenProps } from "@/app/render-screen-props";

export function RenderAlchemyScreen({
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
  playableHandCardKeys,
  battleScreenData,
  hasUnspentTalents,
  hasAffordableHomestead,
  pendingCharacterId,
  onOpenBattleMenu,
  onClearSaveData,
  onUnlockAllDevMode,
}: RenderAlchemyScreenProps) {
  const appValues = useAppStore(
    useShallow((s) => ({
      selectedAspectRatio: s.selectedAspectRatio,
      displayMode: s.displayMode,
      uiScale: s.uiScale,
      brightness: s.brightness,
      masterVol: s.masterVol,
      musicVol: s.musicVol,
      sfxVol: s.sfxVol,
      muteInBackground: s.muteInBackground,
      autoEndTurn: s.autoEndTurn,
      discoveredCardIds: s.discoveredCardIds,
      completedDifficulties: s.completedDifficulties,
      collectionTab: s.collectionTab,
      collectionPages: s.collectionPages,
      encounteredEnemyIds: s.encounteredEnemyIds,
      discoveredTrinketIds: s.discoveredTrinketIds,
      showClearSaveConfirm: s.showClearSaveConfirm,
    })),
  );
  const appActions = useAppActions();
  const runScreenData = useRunScreenData(screen);
  const homesteadValues = useHomesteadStore(
    useShallow((s) => ({
      materialInventory: s.materialInventory,
      constructedBuildings: s.constructedBuildings,
      plantedFarms: s.plantedFarms,
      completedResearch: s.completedResearch,
      bondedCompanions: s.bondedCompanions,
    })),
  );
  const homesteadActions = useHomesteadActions();

  return renderAlchemyScreenRoute({
    screen,
    actions: a,
    appValues,
    appActions,
    homesteadValues,
    homesteadActions,
    runScreenData,
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
    playableHandCardKeys,
    battleScreenData,
    hasUnspentTalents,
    hasAffordableHomestead,
    pendingCharacterId,
    onOpenBattleMenu,
    onClearSaveData,
    onUnlockAllDevMode,
  });
}
