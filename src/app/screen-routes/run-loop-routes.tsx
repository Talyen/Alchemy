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
} from "@/features/alchemy/run-loop/screens";
import {
  useIsWildwoodRun,
  useRunScreenData,
  useTalentAdapter,
} from "@/features/alchemy/shared/stores/run-session-facade";
import { getCampfireHealFraction } from "@/lib/game-constants";
import type { BattleRouteCtx, RunLoopRouteCtx } from "./route-ctx";

function BattleScreenRoute({ routeCommands, battleBindings, onOpenBattleMenu }: BattleRouteCtx) {
  const commands = routeCommands.battle;
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
      onCardClick={commands.handleCardClick}
      onOpenMenu={onOpenBattleMenu}
      onWishChoice={commands.handleWishChoice}
      onRemoveCardGhost={commands.removeCardGhost}
      onSkipCombatDevMode={commands.skipCombatDevMode}
      onEndTurn={commands.handleEndTurn}
      cardTransfers={cardTransfers}
      hiddenHandCardKeys={hiddenHandCardKeys}
      cardTransferInProgress={cardTransferInProgress}
      playableHandCardKeys={playableHandCardKeys}
    />
  );
}

type RunLoopCommands = RunLoopRouteCtx["routeCommands"]["runLoop"];

function LabyrinthMapScreenRoute({
  commands,
  onOpenBattleMenu,
}: {
  commands: RunLoopCommands;
  onOpenBattleMenu: RunLoopRouteCtx["onOpenBattleMenu"];
}) {
  const r = useRunScreenData("labyrinth-map");
  return (
    <LabyrinthMapScreen
      labyrinthMap={r.labyrinthMap}
      onNodeClick={commands.handleLabyrinthNodeEnter}
      onOpenMenu={onOpenBattleMenu}
    />
  );
}

function RewardsScreenRoute({ commands }: { commands: RunLoopCommands }) {
  const r = useRunScreenData("rewards");
  const isWildwood = useIsWildwoodRun();
  return (
    <RewardsScreen
      rewardState={r.rewardState}
      onAddReward={commands.finishRewards}
      onSkip={commands.finishRewards}
      onSelectReward={commands.selectRewardChoice}
      allowTrinketSkip={isWildwood}
    />
  );
}

function WildwoodRecoveryScreenRoute({ commands }: { commands: RunLoopCommands }) {
  const r = useRunScreenData("wildwood-recovery");
  return (
    <WildwoodRecoveryScreen
      playerHealth={r.runPlayerHealth}
      maxHealth={r.runMaxHealth}
      onComplete={commands.handleWildwoodRecoveryComplete}
    />
  );
}

function WildwoodRemovalScreenRoute({ commands }: { commands: RunLoopCommands }) {
  const r = useRunScreenData("wildwood-removal");
  return (
    <WildwoodRemovalScreen
      runDeck={r.runDeck}
      onRemove={commands.handleWildwoodRemoveCard}
      onSkip={commands.handleWildwoodSkipRemoval}
    />
  );
}

function DestinationScreenRoute({ commands }: { commands: RunLoopCommands }) {
  const r = useRunScreenData("destination");
  return (
    <DestinationScreen
      rewardState={r.rewardState}
      onChoose={commands.handleDestinationChoice}
      onPrepare={commands.prepareDestinationScreen}
    />
  );
}

function CampfireScreenRoute({ commands }: { commands: RunLoopCommands }) {
  const r = useRunScreenData("campfire");
  const { talentEffects } = useTalentAdapter();
  const healFraction = getCampfireHealFraction(talentEffects.campfireHealBonus);
  return (
    <CampfireScreen
      playerHealth={r.runPlayerHealth}
      maxHealth={r.runMaxHealth}
      healFraction={healFraction}
      onContinue={commands.handleCampfireContinue}
    />
  );
}

function ShopScreenRoute({ commands }: { commands: RunLoopCommands }) {
  const r = useRunScreenData("shop");
  return (
    <MerchantShopScreen
      gold={r.runGold}
      runDeck={r.runDeck}
      shopCards={r.shopState.cards}
      refreshesLeft={r.shopState.refreshesLeft}
      removeUsed={r.shopState.removeUsed}
      purchasedSlotKeys={r.shopState.purchasedSlotKeys}
      getCardPrice={commands.getMerchantCardBuyPrice}
      removePrice={commands.getRemoveCardPrice()}
      refreshPrice={commands.getShopRefreshPrice(r.shopState.refreshesLeft)}
      onBuyCard={commands.handleShopBuyCard}
      onRemoveCard={commands.handleShopRemoveCard}
      onRefresh={commands.handleShopRefresh}
      onContinue={commands.handleShopContinue}
    />
  );
}

function AlchemistScreenRoute({ commands }: { commands: RunLoopCommands }) {
  const r = useRunScreenData("alchemist");
  return (
    <AlchemistShopScreen
      gold={r.runGold}
      runDeck={r.runDeck}
      potionCards={r.alchemistState.potions}
      refreshesLeft={r.alchemistState.refreshesLeft}
      mixUsed={r.alchemistState.mixUsed}
      purchasedSlotKeys={r.alchemistState.purchasedSlotKeys}
      getPotionPrice={commands.getAlchemistPotionBuyPrice}
      mixPrice={commands.getMixPotionPrice()}
      refreshPrice={commands.getAlchemistRefreshPrice(r.alchemistState.refreshesLeft)}
      onBuyCard={commands.handleAlchemistBuyCard}
      onRefresh={commands.handleAlchemistRefresh}
      onMixPotions={commands.handleAlchemistMixPotions}
      onContinue={commands.handleAlchemistContinue}
    />
  );
}

function TrinketShopScreenRoute({ commands }: { commands: RunLoopCommands }) {
  const r = useRunScreenData("trinket-shop");
  return (
    <TrinketShopScreen
      gold={r.runGold}
      trinkets={r.trinketShopState.trinkets}
      refreshesLeft={r.trinketShopState.refreshesLeft}
      purchasedSlotKeys={r.trinketShopState.purchasedSlotKeys}
      getTrinketPrice={commands.getTrinketBuyPrice}
      refreshPrice={commands.getTrinketRefreshPrice(r.trinketShopState.refreshesLeft)}
      onBuyTrinket={commands.handleTrinketShopBuy}
      onRefresh={commands.handleTrinketShopRefresh}
      onContinue={commands.handleTrinketShopContinue}
    />
  );
}

function EquipmentShopScreenRoute({ commands }: { commands: RunLoopCommands }) {
  const r = useRunScreenData("equipment-shop");
  return (
    <EquipmentShopScreen
      gold={r.runGold}
      gear={r.equipmentShopState.gear}
      refreshesLeft={r.equipmentShopState.refreshesLeft}
      purchasedSlotKeys={r.equipmentShopState.purchasedSlotKeys}
      getGearPrice={commands.getGearBuyPrice}
      refreshPrice={commands.getEquipmentRefreshPrice(r.equipmentShopState.refreshesLeft)}
      onBuyGear={commands.handleEquipmentShopBuy}
      onRefresh={commands.handleEquipmentShopRefresh}
      onContinue={commands.handleEquipmentShopContinue}
    />
  );
}

function MysteryScreenRoute({ commands }: { commands: RunLoopCommands }) {
  const r = useRunScreenData("mystery");
  const { handleMysteryContinue } = commands;

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
      onChoose={commands.handleMysteryChoice}
      onChooseCard={commands.handleMysteryChooseCard}
      onRemoveCard={commands.handleMysteryRemoveCard}
      onContinue={commands.handleMysteryContinue}
      findCard={(id) => cardLibrary.find((c) => c.id === id)}
      findTrinket={(id) => trinketLibrary.find((t) => t.id === id)}
    />
  );
}

function CorruptionScreenRoute({ commands }: { commands: RunLoopCommands }) {
  const r = useRunScreenData("corruption");
  return (
    <CorruptionScreen
      runDeck={r.runDeck}
      result={r.corruptionResult}
      onCorrupt={commands.handleCorruptCard}
      onExit={commands.handleCorruptionExit}
    />
  );
}

export const runLoopScreenRoutes: {
  battle: (ctx: BattleRouteCtx) => ReactNode;
  "labyrinth-map": (ctx: RunLoopRouteCtx) => ReactNode;
  rewards: (ctx: RunLoopRouteCtx) => ReactNode;
  "wildwood-recovery": (ctx: RunLoopRouteCtx) => ReactNode;
  "wildwood-removal": (ctx: RunLoopRouteCtx) => ReactNode;
  destination: (ctx: RunLoopRouteCtx) => ReactNode;
  campfire: (ctx: RunLoopRouteCtx) => ReactNode;
  shop: (ctx: RunLoopRouteCtx) => ReactNode;
  alchemist: (ctx: RunLoopRouteCtx) => ReactNode;
  "trinket-shop": (ctx: RunLoopRouteCtx) => ReactNode;
  "equipment-shop": (ctx: RunLoopRouteCtx) => ReactNode;
  mystery: (ctx: RunLoopRouteCtx) => ReactNode;
  corruption: (ctx: RunLoopRouteCtx) => ReactNode;
} = {
  battle: ({ routeCommands, battleBindings, onOpenBattleMenu }) => (
    <BattleScreenRoute
      routeCommands={routeCommands}
      battleBindings={battleBindings}
      onOpenBattleMenu={onOpenBattleMenu}
    />
  ),
  "labyrinth-map": ({ routeCommands, onOpenBattleMenu }) => (
    <LabyrinthMapScreenRoute commands={routeCommands.runLoop} onOpenBattleMenu={onOpenBattleMenu} />
  ),
  rewards: ({ routeCommands }) => <RewardsScreenRoute commands={routeCommands.runLoop} />,
  "wildwood-recovery": ({ routeCommands }) => <WildwoodRecoveryScreenRoute commands={routeCommands.runLoop} />,
  "wildwood-removal": ({ routeCommands }) => <WildwoodRemovalScreenRoute commands={routeCommands.runLoop} />,
  destination: ({ routeCommands }) => <DestinationScreenRoute commands={routeCommands.runLoop} />,
  campfire: ({ routeCommands }) => <CampfireScreenRoute commands={routeCommands.runLoop} />,
  shop: ({ routeCommands }) => <ShopScreenRoute commands={routeCommands.runLoop} />,
  alchemist: ({ routeCommands }) => <AlchemistScreenRoute commands={routeCommands.runLoop} />,
  "trinket-shop": ({ routeCommands }) => <TrinketShopScreenRoute commands={routeCommands.runLoop} />,
  "equipment-shop": ({ routeCommands }) => <EquipmentShopScreenRoute commands={routeCommands.runLoop} />,
  mystery: ({ routeCommands }) => <MysteryScreenRoute commands={routeCommands.runLoop} />,
  corruption: ({ routeCommands }) => <CorruptionScreenRoute commands={routeCommands.runLoop} />,
};
