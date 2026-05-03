import { useEffect, useRef, useState } from "react";

import { menuLogo } from "@/lib/game-data";

import { useVirtualResolution } from "@/features/alchemy/hooks";
import { BattleScreen } from "@/features/alchemy/screens/battle-screen";
import {
  CollectionScreen,
  DestinationScreen,
  MenuScreen,
  OptionsScreen,
  RewardsScreen,
  TalentsScreen,
} from "@/features/alchemy/screens/meta-screens";
import {
  clearAlchemySaveData,
  defaultSaveData,
  loadAlchemySaveData,
  saveAlchemySaveData,
} from "@/features/alchemy/storage";
import type { CollectionTab, ResolutionOption } from "@/features/alchemy/types";
import { useAlchemyRunController } from "@/features/alchemy/use-alchemy-run-controller";

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
  const [showClearSaveConfirm, setShowClearSaveConfirm] = useState(false);
  const [collectionTab, setCollectionTab] = useState<CollectionTab>("cards");
  const [collectionPages, setCollectionPages] = useState<CollectionPages>(initialCollectionPages);
  const [discoveredCardIds, setDiscoveredCardIds] = useState<string[]>(initialSave.discoveredCardIds);
  const [encounteredEnemyIds, setEncounteredEnemyIds] = useState<string[]>(initialSave.encounteredEnemyIds);
  const [discoveredTrinketIds, setDiscoveredTrinketIds] = useState<string[]>(initialSave.discoveredTrinketIds);

  const { frameStyle, stageStyle } = useVirtualResolution(selectedResolution);
  const run = useAlchemyRunController({ setDiscoveredCardIds, setEncounteredEnemyIds });
  const currentCollectionPage = collectionPages[collectionTab];

  useEffect(() => {
    saveAlchemySaveData({
      selectedResolution,
      discoveredCardIds,
      encounteredEnemyIds,
      discoveredTrinketIds,
    });
  }, [selectedResolution, discoveredCardIds, encounteredEnemyIds, discoveredTrinketIds]);

  function handleCollectionTabChange(nextTab: CollectionTab) {
    setCollectionTab(nextTab);
    setCollectionPages((current) => ({ ...current, [nextTab]: current[nextTab] ?? 0 }));
  }

  function setCollectionPage(page: number) {
    setCollectionPages((current) => ({ ...current, [collectionTab]: Math.max(0, page) }));
  }

  function clearSaveData() {
    clearAlchemySaveData();
    setSelectedResolution(defaultSaveData.selectedResolution);
    setDiscoveredCardIds(defaultSaveData.discoveredCardIds);
    setEncounteredEnemyIds(defaultSaveData.encounteredEnemyIds);
    setDiscoveredTrinketIds(defaultSaveData.discoveredTrinketIds);
    setCollectionPages(initialCollectionPages);
    setCollectionTab("cards");
    setShowClearSaveConfirm(false);
    run.resetRunState();
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center overflow-hidden bg-background p-4">
      <div className="relative" style={frameStyle}>
        <div className="absolute left-0 top-0 overflow-hidden bg-background" style={stageStyle}>
          {run.screen === "menu" ? <MenuScreen onPlay={run.beginRun} onCollection={() => run.goToScreen("collection")} onOptions={() => run.goToScreen("options")} onTalents={() => run.goToScreen("talents")} logoSrc={menuLogo} /> : null}
          {run.screen === "battle" ? <BattleScreen battleState={run.battleState} hoveredCardId={run.hoveredCardId} setHoveredCardId={run.setHoveredCardId} shimmerState={run.shimmerState} onHoverShimmer={run.maybeTriggerShimmer} playerStatusChips={run.playerStatusChips} enemyStatusChips={run.enemyStatusChips} playerCombatTexts={run.playerCombatTexts} enemyCombatTexts={run.enemyCombatTexts} handCardRefs={run.handCardRefs} onCardPointerDown={run.handleCardPointerDown} onKeyboardPlay={run.handleKeyboardPlay} activeDraggedCardId={run.activeDraggedCardId} menuOpen={run.menuOpen} setMenuOpen={run.setMenuOpen} onGoToScreen={run.goToScreen} onWishChoice={run.handleWishChoice} cardGhosts={run.cardGhosts} onRemoveCardGhost={run.removeCardGhost} dragPreview={run.dragPreview} onSkipCombatDevMode={run.skipCombatDevMode} battleSceneRef={run.battleSceneRef} playerPanelRef={run.playerPanelRef} enemyPanelRef={run.enemyPanelRef} /> : null}
          {run.screen === "rewards" ? <RewardsScreen rewardChoices={run.rewardChoices} rewardGold={run.rewardGold} hoveredCardId={run.hoveredCardId} onHoverChange={run.setHoveredCardId} shimmerState={run.shimmerState} onHoverShimmer={run.maybeTriggerShimmer} selectedRewardId={run.selectedRewardId} onSelectReward={run.setSelectedRewardId} onAddCard={() => { const chosen = run.rewardChoices.find((card) => card.id === run.selectedRewardId); if (chosen) { run.finishRewards(chosen); } }} onSkip={() => run.finishRewards()} /> : null}
          {run.screen === "destination" ? <DestinationScreen destinationOptions={run.destinationOptions} onChoose={run.handleDestinationChoice} destinationButtonRefs={run.destinationButtonRefs} /> : null}
          {run.screen === "options" ? <OptionsScreen hasActiveBattle={run.hasActiveBattle} onMainMenu={() => run.goToScreen("menu")} onReturnToBattle={run.returnToBattle} selectedResolution={selectedResolution} onResolutionChange={setSelectedResolution} showClearSaveConfirm={showClearSaveConfirm} onOpenClearSaveConfirm={() => setShowClearSaveConfirm(true)} onCloseClearSaveConfirm={() => setShowClearSaveConfirm(false)} onConfirmClearSave={clearSaveData} /> : null}
          {run.screen === "collection" ? <CollectionScreen hasActiveBattle={run.hasActiveBattle} onMainMenu={() => run.goToScreen("menu")} onReturnToBattle={run.returnToBattle} collectionTab={collectionTab} onSelectTab={handleCollectionTabChange} hoveredCardId={run.hoveredCardId} onHoverChange={run.setHoveredCardId} discoveredCardIds={discoveredCardIds} encounteredEnemyIds={encounteredEnemyIds} discoveredTrinketIds={discoveredTrinketIds} page={currentCollectionPage} onPageChange={setCollectionPage} /> : null}
          {run.screen === "talents" ? <TalentsScreen hasActiveBattle={run.hasActiveBattle} onMainMenu={() => run.goToScreen("menu")} onReturnToBattle={run.returnToBattle} /> : null}
        </div>
      </div>
    </div>
  );
}