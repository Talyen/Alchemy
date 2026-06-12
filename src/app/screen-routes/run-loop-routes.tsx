import { useEffect, type ReactNode } from "react";
import { cardLibrary, trinketLibrary } from "@/lib/game-data";
import { useAppScreenChrome } from "@/app/app-screen-chrome-context";
import {
  AlchemistShopScreen,
  BattleScreen,
  CampfireScreen,
  CorruptionScreen,
  DestinationScreen,
  LabyrinthMapScreen,
  MerchantShopScreen,
  MysteryScreen,
  RewardsScreen,
  WildwoodRecoveryScreen,
  WildwoodRemovalScreen,
} from "@/features/alchemy/shared/screens";
import { useRunDomainStore } from "@/features/alchemy/shared/stores/run-session-facade";
import type { ScreenRouteContext } from "./types";

function BattleScreenRoute({
  actions: a,
  battleBindings,
  onOpenBattleMenu,
}: Pick<ScreenRouteContext, "actions" | "battleBindings" | "onOpenBattleMenu">) {
  const { heroArt, playerName, aspectMode, stagePixelRatio } = useAppScreenChrome();
  const {
    battleScreenData,
    handCardRefs,
    drawPileRef,
    discardPileRef,
    battleSceneRef,
    playerPanelRef,
    enemyPanelRef,
    cardTransfers,
    hiddenHandCardKeys,
    cardTransferInProgress,
    playableHandCardKeys,
  } = battleBindings;

  return (
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
  );
}

import { useRunScreenData } from "@/features/alchemy/shared/stores/run-session-facade";

function LabyrinthMapScreenRoute({
  actions: a,
  onOpenBattleMenu,
}: Pick<ScreenRouteContext, "actions" | "onOpenBattleMenu">) {
  const r = useRunScreenData("labyrinth-map");
  return (
    <LabyrinthMapScreen
      labyrinthMap={r.labyrinthMap}
      onNodeClick={a.runFlow.handleLabyrinthNodeEnter}
      onOpenMenu={onOpenBattleMenu}
    />
  );
}

function RewardsScreenRoute({ actions: a }: Pick<ScreenRouteContext, "actions">) {
  const r = useRunScreenData("rewards");
  const isWildwood = useRunDomainStore((s) => s.progress.contentSystemType === "wildwood");
  return (
    <RewardsScreen
      rewardState={r.rewardState}
      onAddReward={a.runFlow.finishRewards}
      onSkip={a.runFlow.finishRewards}
      onSelectReward={a.runFlow.selectRewardChoice}
      allowTrinketSkip={isWildwood}
    />
  );
}

function WildwoodRecoveryScreenRoute({ actions: a }: Pick<ScreenRouteContext, "actions">) {
  const r = useRunScreenData("wildwood-recovery");
  return (
    <WildwoodRecoveryScreen
      playerHealth={r.runPlayerHealth}
      maxHealth={r.runMaxHealth}
      onComplete={a.runFlow.handleWildwoodRecoveryComplete}
    />
  );
}

function WildwoodRemovalScreenRoute({ actions: a }: Pick<ScreenRouteContext, "actions">) {
  const r = useRunScreenData("wildwood-removal");
  return (
    <WildwoodRemovalScreen
      runDeck={r.runDeck}
      onRemove={a.runFlow.handleWildwoodRemoveCard}
      onSkip={a.runFlow.handleWildwoodSkipRemoval}
    />
  );
}

function DestinationScreenRoute({ actions: a }: Pick<ScreenRouteContext, "actions">) {
  const r = useRunScreenData("destination");
  return (
    <DestinationScreen
      rewardState={r.rewardState}
      onChoose={a.runFlow.handleDestinationChoice}
      onPrepare={a.runFlow.prepareDestinationScreen}
    />
  );
}

function CampfireScreenRoute({ actions: a }: Pick<ScreenRouteContext, "actions">) {
  const r = useRunScreenData("campfire");
  return (
    <CampfireScreen
      playerHealth={r.runPlayerHealth}
      maxHealth={r.runMaxHealth}
      onContinue={a.runFlow.handleCampfireContinue}
    />
  );
}

function ShopScreenRoute({ actions: a }: Pick<ScreenRouteContext, "actions">) {
  const r = useRunScreenData("shop");
  return (
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
  );
}

function AlchemistScreenRoute({ actions: a }: Pick<ScreenRouteContext, "actions">) {
  const r = useRunScreenData("alchemist");
  return (
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
  );
}

function MysteryScreenRoute({ actions: a }: Pick<ScreenRouteContext, "actions">) {
  const r = useRunScreenData("mystery");

  useEffect(() => {
    if (!r.mysteryEvent) {
      a.runFlow.handleMysteryContinue();
    }
  }, [r.mysteryEvent, a.runFlow]);

  if (!r.mysteryEvent) {
    return null;
  }

  return (
    <MysteryScreen
      event={r.mysteryEvent}
      runDeck={r.runDeck}
      mysteryCardChoices={r.mysteryCardChoices}
      onChoose={a.runFlow.handleMysteryChoice}
      onChooseCard={a.runFlow.handleMysteryChooseCard}
      onRemoveCard={a.runFlow.handleMysteryRemoveCard}
      onContinue={a.runFlow.handleMysteryContinue}
      findCard={(id) => cardLibrary.find((c) => c.id === id)}
      findTrinket={(id) => trinketLibrary.find((t) => t.id === id)}
    />
  );
}

function CorruptionScreenRoute({ actions: a }: Pick<ScreenRouteContext, "actions">) {
  const r = useRunScreenData("corruption");
  return (
    <CorruptionScreen
      runDeck={r.runDeck}
      result={r.corruptionResult}
      onCorrupt={a.runFlow.handleCorruptCard}
      onExit={a.runFlow.handleCorruptionExit}
    />
  );
}

export const runLoopScreenRoutes: Partial<
  Record<import("@/lib/routing").Screen, (ctx: ScreenRouteContext) => ReactNode>
> = {
  battle: ({ actions: a, battleBindings, onOpenBattleMenu }) => (
    <BattleScreenRoute actions={a} battleBindings={battleBindings} onOpenBattleMenu={onOpenBattleMenu} />
  ),
  "labyrinth-map": ({ actions: a, onOpenBattleMenu }) => (
    <LabyrinthMapScreenRoute actions={a} onOpenBattleMenu={onOpenBattleMenu} />
  ),
  rewards: ({ actions: a }) => <RewardsScreenRoute actions={a} />,
  "wildwood-recovery": ({ actions: a }) => <WildwoodRecoveryScreenRoute actions={a} />,
  "wildwood-removal": ({ actions: a }) => <WildwoodRemovalScreenRoute actions={a} />,
  destination: ({ actions: a }) => <DestinationScreenRoute actions={a} />,
  campfire: ({ actions: a }) => <CampfireScreenRoute actions={a} />,
  shop: ({ actions: a }) => <ShopScreenRoute actions={a} />,
  alchemist: ({ actions: a }) => <AlchemistScreenRoute actions={a} />,
  mystery: ({ actions: a }) => <MysteryScreenRoute actions={a} />,
  corruption: ({ actions: a }) => <CorruptionScreenRoute actions={a} />,
};
