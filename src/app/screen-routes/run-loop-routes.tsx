import type { ReactNode } from "react";
import { cardLibrary, trinketLibrary } from "@/lib/game-data";
import {
  AlchemistShopScreen,
  BattleScreen,
  CampfireScreen,
  CorruptionScreen,
  DestinationScreen,
  GameOverScreen,
  LabyrinthMapScreen,
  MerchantShopScreen,
  MysteryScreen,
  RewardsScreen,
  RunVictoryScreen,
} from "@/features/alchemy/screens";
import type { ScreenRouteContext } from "./types";

export const runLoopScreenRoutes: Partial<
  Record<import("@/lib/routing").Screen, (ctx: ScreenRouteContext) => ReactNode>
> = {
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
  "labyrinth-map": ({ actions: a, onOpenBattleMenu, runScreenData: r }) => (
    <LabyrinthMapScreen
      labyrinthMap={r.labyrinthMap}
      onNodeClick={a.runFlow.handleLabyrinthNodeEnter}
      onOpenMenu={onOpenBattleMenu}
    />
  ),
  rewards: ({ actions: a, runScreenData: r }) => (
    <RewardsScreen
      rewardState={r.rewardState}
      onAddReward={a.runFlow.finishRewards}
      onSkip={a.runFlow.finishRewards}
      onSelectReward={a.runFlow.selectRewardChoice}
    />
  ),
  destination: ({ actions: a, runScreenData: r }) => (
    <DestinationScreen
      rewardState={r.rewardState}
      onChoose={a.runFlow.handleDestinationChoice}
      onPrepare={a.runFlow.prepareDestinationScreen}
    />
  ),
  campfire: ({ actions: a, runScreenData: r }) => (
    <CampfireScreen
      playerHealth={r.runPlayerHealth}
      maxHealth={r.runMaxHealth}
      onContinue={a.runFlow.handleCampfireContinue}
    />
  ),
  shop: ({ actions: a, runScreenData: r }) => (
    <MerchantShopScreen
      gold={r.runGold}
      runDeck={r.runDeck}
      shopCards={r.shopState.cards}
      refreshesLeft={r.shopState.refreshesLeft}
      removeUsed={r.shopState.removeUsed}
      onBuyCard={a.runFlow.handleShopBuyCard}
      onRemoveCard={a.runFlow.handleShopRemoveCard}
      onRefresh={a.runFlow.handleShopRefresh}
      onContinue={a.runFlow.handleShopContinue}
    />
  ),
  alchemist: ({ actions: a, runScreenData: r }) => (
    <AlchemistShopScreen
      gold={r.runGold}
      runDeck={r.runDeck}
      potionCards={r.alchemistState.potions}
      refreshesLeft={r.alchemistState.refreshesLeft}
      mixUsed={r.alchemistState.mixUsed}
      onBuyCard={a.runFlow.handleAlchemistBuyCard}
      onRefresh={a.runFlow.handleAlchemistRefresh}
      onMixPotions={a.runFlow.handleAlchemistMixPotions}
      onContinue={a.runFlow.handleAlchemistContinue}
    />
  ),
  mystery: ({ actions: a, runScreenData: r }) => (
    <MysteryScreen
      event={r.mysteryEvent!}
      runDeck={r.runDeck}
      mysteryCardChoices={r.mysteryCardChoices}
      onChoose={a.runFlow.handleMysteryChoice}
      onChooseCard={a.runFlow.handleMysteryChooseCard}
      onRemoveCard={a.runFlow.handleMysteryRemoveCard}
      onContinue={a.runFlow.handleMysteryContinue}
      findCard={(id) => cardLibrary.find((c) => c.id === id)}
      findTrinket={(id) => trinketLibrary.find((t) => t.id === id)}
    />
  ),
  corruption: ({ actions: a, runScreenData: r }) => (
    <CorruptionScreen
      runDeck={r.runDeck}
      result={r.corruptionResult}
      onCorrupt={a.runFlow.handleCorruptCard}
      onExit={a.runFlow.handleCorruptionExit}
    />
  ),
  "game-over": ({ actions: a, runScreenData: r }) => (
    <GameOverScreen
      runEndTalentXP={r.runEndTalentXP}
      talentXP={r.talentXP}
      runEndMaterials={r.runEndMaterials}
      onMainMenu={a.runFlow.resetRunState}
    />
  ),
  "run-victory": ({ actions: a, runScreenData: r }) => (
    <RunVictoryScreen
      runEndTalentXP={r.runEndTalentXP}
      talentXP={r.talentXP}
      runEndMaterials={r.runEndMaterials}
      onMainMenu={a.runFlow.resetRunState}
    />
  ),
};
