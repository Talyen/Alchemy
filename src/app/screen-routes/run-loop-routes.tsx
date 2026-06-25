import { useEffect, type ReactNode } from "react";
import { cardLibrary, trinketLibrary } from "@/features/alchemy/shared/config/game-data-catalog";
import { useAppScreenChrome } from "@/app/app-screen-chrome-context";
import {
  AlchemistShopScreen,
  BattleScreen,
  CampfireScreen,
  CorruptionScreen,
  DestinationScreen,
  EquipmentShopScreen,
  LabyrinthMapScreen,
  MerchantShopScreen,
  MysteryScreen,
  RewardsScreen,
  TrinketShopScreen,
  WildwoodRecoveryScreen,
  WildwoodRemovalScreen,
} from "@/features/alchemy/shared/screens";
import { useRunDomainStore } from "@/features/alchemy/shared/stores/run-session-facade";
import type { ScreenRouteContext } from "./types";

function BattleScreenRoute({
  run,
  battleBindings,
  onOpenBattleMenu,
}: Pick<ScreenRouteContext, "run" | "battleBindings" | "onOpenBattleMenu">) {
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
      onCardClick={run.handleCardClick}
      onOpenMenu={onOpenBattleMenu}
      onWishChoice={run.handleWishChoice}
      onRemoveCardGhost={run.removeCardGhost}
      onSkipCombatDevMode={run.skipCombatDevMode}
      onEndTurn={run.handleEndTurn}
      cardTransfers={cardTransfers}
      hiddenHandCardKeys={hiddenHandCardKeys}
      cardTransferInProgress={cardTransferInProgress}
      playableHandCardKeys={playableHandCardKeys}
    />
  );
}

import { useRunScreenData } from "@/features/alchemy/shared/stores/run-session-facade";

function LabyrinthMapScreenRoute({ run, onOpenBattleMenu }: Pick<ScreenRouteContext, "run" | "onOpenBattleMenu">) {
  const r = useRunScreenData("labyrinth-map");
  return (
    <LabyrinthMapScreen
      labyrinthMap={r.labyrinthMap}
      onNodeClick={run.handleLabyrinthNodeEnter}
      onOpenMenu={onOpenBattleMenu}
    />
  );
}

function RewardsScreenRoute({ run }: Pick<ScreenRouteContext, "run">) {
  const r = useRunScreenData("rewards");
  const isWildwood = useRunDomainStore((s) => s.progress.contentSystemType === "wildwood");
  return (
    <RewardsScreen
      rewardState={r.rewardState}
      onAddReward={run.finishRewards}
      onSkip={run.finishRewards}
      onSelectReward={run.selectRewardChoice}
      allowTrinketSkip={isWildwood}
    />
  );
}

function WildwoodRecoveryScreenRoute({ run }: Pick<ScreenRouteContext, "run">) {
  const r = useRunScreenData("wildwood-recovery");
  return (
    <WildwoodRecoveryScreen
      playerHealth={r.runPlayerHealth}
      maxHealth={r.runMaxHealth}
      onComplete={run.handleWildwoodRecoveryComplete}
    />
  );
}

function WildwoodRemovalScreenRoute({ run }: Pick<ScreenRouteContext, "run">) {
  const r = useRunScreenData("wildwood-removal");
  return (
    <WildwoodRemovalScreen
      runDeck={r.runDeck}
      onRemove={run.handleWildwoodRemoveCard}
      onSkip={run.handleWildwoodSkipRemoval}
    />
  );
}

function DestinationScreenRoute({ run }: Pick<ScreenRouteContext, "run">) {
  const r = useRunScreenData("destination");
  return (
    <DestinationScreen
      rewardState={r.rewardState}
      onChoose={run.handleDestinationChoice}
      onPrepare={run.prepareDestinationScreen}
    />
  );
}

function CampfireScreenRoute({ run }: Pick<ScreenRouteContext, "run">) {
  const r = useRunScreenData("campfire");
  return (
    <CampfireScreen
      playerHealth={r.runPlayerHealth}
      maxHealth={r.runMaxHealth}
      onContinue={run.handleCampfireContinue}
    />
  );
}

function ShopScreenRoute({ run }: Pick<ScreenRouteContext, "run">) {
  const r = useRunScreenData("shop");
  return (
    <MerchantShopScreen
      gold={r.runGold}
      runDeck={r.runDeck}
      shopCards={r.shopState.cards}
      refreshesLeft={r.shopState.refreshesLeft}
      removeUsed={r.shopState.removeUsed}
      purchasedSlotKeys={r.shopState.purchasedSlotKeys}
      getCardPrice={run.getMerchantCardBuyPrice}
      removePrice={run.getRemoveCardPrice()}
      refreshPrice={run.getShopRefreshPrice(r.shopState.refreshesLeft)}
      onBuyCard={run.handleShopBuyCard}
      onRemoveCard={run.handleShopRemoveCard}
      onRefresh={run.handleShopRefresh}
      onContinue={run.handleShopContinue}
    />
  );
}

function AlchemistScreenRoute({ run }: Pick<ScreenRouteContext, "run">) {
  const r = useRunScreenData("alchemist");
  return (
    <AlchemistShopScreen
      gold={r.runGold}
      runDeck={r.runDeck}
      potionCards={r.alchemistState.potions}
      refreshesLeft={r.alchemistState.refreshesLeft}
      mixUsed={r.alchemistState.mixUsed}
      purchasedSlotKeys={r.alchemistState.purchasedSlotKeys}
      getPotionPrice={run.getAlchemistPotionBuyPrice}
      mixPrice={run.getMixPotionPrice()}
      refreshPrice={run.getAlchemistRefreshPrice(r.alchemistState.refreshesLeft)}
      onBuyCard={run.handleAlchemistBuyCard}
      onRefresh={run.handleAlchemistRefresh}
      onMixPotions={run.handleAlchemistMixPotions}
      onContinue={run.handleAlchemistContinue}
    />
  );
}

function TrinketShopScreenRoute({ run }: Pick<ScreenRouteContext, "run">) {
  const r = useRunScreenData("trinket-shop");
  return (
    <TrinketShopScreen
      gold={r.runGold}
      trinkets={r.trinketShopState.trinkets}
      refreshesLeft={r.trinketShopState.refreshesLeft}
      purchasedSlotKeys={r.trinketShopState.purchasedSlotKeys}
      getTrinketPrice={run.getTrinketBuyPrice}
      refreshPrice={run.getTrinketRefreshPrice(r.trinketShopState.refreshesLeft)}
      onBuyTrinket={run.handleTrinketShopBuy}
      onRefresh={run.handleTrinketShopRefresh}
      onContinue={run.handleTrinketShopContinue}
    />
  );
}

function EquipmentShopScreenRoute({ run }: Pick<ScreenRouteContext, "run">) {
  const r = useRunScreenData("equipment-shop");
  return (
    <EquipmentShopScreen
      gold={r.runGold}
      gear={r.equipmentShopState.gear}
      refreshesLeft={r.equipmentShopState.refreshesLeft}
      purchasedSlotKeys={r.equipmentShopState.purchasedSlotKeys}
      getGearPrice={run.getGearBuyPrice}
      refreshPrice={run.getEquipmentRefreshPrice(r.equipmentShopState.refreshesLeft)}
      onBuyGear={run.handleEquipmentShopBuy}
      onRefresh={run.handleEquipmentShopRefresh}
      onContinue={run.handleEquipmentShopContinue}
    />
  );
}

function MysteryScreenRoute({ run }: Pick<ScreenRouteContext, "run">) {
  const r = useRunScreenData("mystery");
  const { handleMysteryContinue } = run;

  useEffect(() => {
    if (!r.mysteryEvent) {
      handleMysteryContinue();
    }
  }, [r.mysteryEvent, handleMysteryContinue]);

  if (!r.mysteryEvent) {
    return null;
  }

  return (
    <MysteryScreen
      event={r.mysteryEvent}
      runDeck={r.runDeck}
      mysteryCardChoices={r.mysteryCardChoices}
      onChoose={run.handleMysteryChoice}
      onChooseCard={run.handleMysteryChooseCard}
      onRemoveCard={run.handleMysteryRemoveCard}
      onContinue={run.handleMysteryContinue}
      findCard={(id) => cardLibrary.find((c) => c.id === id)}
      findTrinket={(id) => trinketLibrary.find((t) => t.id === id)}
    />
  );
}

function CorruptionScreenRoute({ run }: Pick<ScreenRouteContext, "run">) {
  const r = useRunScreenData("corruption");
  return (
    <CorruptionScreen
      runDeck={r.runDeck}
      result={r.corruptionResult}
      onCorrupt={run.handleCorruptCard}
      onExit={run.handleCorruptionExit}
    />
  );
}

export const runLoopScreenRoutes: Partial<
  Record<import("@/lib/routing").Screen, (ctx: ScreenRouteContext) => ReactNode>
> = {
  battle: ({ run, battleBindings, onOpenBattleMenu }) => (
    <BattleScreenRoute run={run} battleBindings={battleBindings} onOpenBattleMenu={onOpenBattleMenu} />
  ),
  "labyrinth-map": ({ run, onOpenBattleMenu }) => (
    <LabyrinthMapScreenRoute run={run} onOpenBattleMenu={onOpenBattleMenu} />
  ),
  rewards: ({ run }) => <RewardsScreenRoute run={run} />,
  "wildwood-recovery": ({ run }) => <WildwoodRecoveryScreenRoute run={run} />,
  "wildwood-removal": ({ run }) => <WildwoodRemovalScreenRoute run={run} />,
  destination: ({ run }) => <DestinationScreenRoute run={run} />,
  campfire: ({ run }) => <CampfireScreenRoute run={run} />,
  shop: ({ run }) => <ShopScreenRoute run={run} />,
  alchemist: ({ run }) => <AlchemistScreenRoute run={run} />,
  "trinket-shop": ({ run }) => <TrinketShopScreenRoute run={run} />,
  "equipment-shop": ({ run }) => <EquipmentShopScreenRoute run={run} />,
  mystery: ({ run }) => <MysteryScreenRoute run={run} />,
  corruption: ({ run }) => <CorruptionScreenRoute run={run} />,
};
