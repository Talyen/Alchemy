import { useLayoutEffect, type ReactNode } from "react";
import { useAppScreenChrome } from "@/app/app-screen-chrome-context";
import { useLatestRef } from "@/features/alchemy/shared/hooks";
import {
  AlchemistShopScreen,
  BattleScreen,
  CampfireScreen,
  CorruptionScreen,
  DestinationScreen,
  EquipmentShopScreen,
  LabyrinthMapScreen,
  MerchantShopScreen,
  RewardsScreen,
  TrinketShopScreen,
  WildwoodRemovalScreen,
} from "@/features/alchemy/run-loop/screens";
import { useBattleScreenRouteData } from "@/app/screen-routes/use-battle-screen-route-data";
import { useBattlePlayback } from "@/app/screen-routes/use-battle-playback";
import { MysteryScreenRoute } from "@/app/screen-routes/mystery-screen-route";
import {
  useAlchemistScreenData,
  useCampfireScreenData,
  useCorruptionScreenData,
  useDestinationScreenData,
  useEquipmentShopScreenData,
  useLabyrinthMapScreenData,
  useRewardsScreenData,
  useShopScreenData,
  useTrinketShopScreenData,
  useWildwoodRemovalScreenData,
} from "@/features/alchemy/shared/stores/use-run-screen-data";
import { useTalentEffects } from "@/features/alchemy/shared/stores/run-reads";
import { getCampfireHealFraction } from "@/lib/campfire-heal";
import type { BattleCommands, BattleRouteCtx, RunLoopCommands, RunLoopRouteCtx } from "./route-ctx";

function BattleScreenRoute({
  commands,
  onOpenBattleMenu,
  gameMenuOpen,
}: {
  commands: BattleCommands;
  onOpenBattleMenu: BattleRouteCtx["onOpenBattleMenu"];
  gameMenuOpen: BattleRouteCtx["gameMenuOpen"];
}) {
  const { characterId, heroArt, playerName, aspectMode, stagePixelRatio } = useAppScreenChrome();
  const { battleScreenData, hasActiveBattle } = useBattleScreenRouteData();
  const { isAutoplayEnabled, toggleAutoplay, bind } = useBattlePlayback({
    screen: commands.screen,
    battleState: battleScreenData.battleState,
    hasActiveBattle,
    gameMenuOpen,
    isAutoplayEnabled: commands.isAutoplayEnabled,
    setAutoplayEnabled: commands.setAutoplayEnabled,
    handleEndTurn: commands.handleEndTurn,
    handleAutoplayCard: commands.handleAutoplayCard,
    isCardPlayInProgress: commands.isCardPlayInProgress,
  });
  const bindPlaybackRef = useLatestRef(commands.bindPlayback);
  useLayoutEffect(() => {
    const currentBind = bindPlaybackRef.current;
    currentBind(bind);
    return () => currentBind(null);
  }, [bind, bindPlaybackRef]);

  return (
    <BattleScreen
      battleScreenData={battleScreenData}
      characterId={characterId}
      heroArt={heroArt}
      playerName={playerName}
      aspectMode={aspectMode}
      stagePixelRatio={stagePixelRatio}
      refs={commands.refs}
      onCardClick={commands.handleCardClick}
      onOpenMenu={onOpenBattleMenu}
      onWishChoice={commands.handleWishChoice}
      onSkipCombatDevMode={commands.skipCombatDevMode}
      onEndTurn={commands.handleEndTurn}
      isAutoplayEnabled={isAutoplayEnabled}
      onToggleAutoplay={toggleAutoplay}
    />
  );
}

function LabyrinthMapScreenRoute({
  commands,
  onOpenBattleMenu,
}: {
  commands: RunLoopCommands["labyrinth"];
  onOpenBattleMenu: RunLoopRouteCtx["onOpenBattleMenu"];
}) {
  const r = useLabyrinthMapScreenData();
  return (
    <LabyrinthMapScreen
      labyrinthMap={r.labyrinthMap}
      selectedNodeId={r.selectedLabyrinthNodeId}
      onNodeSelect={commands.handleNodeSelect}
      onNodeDeselect={commands.handleNodeDeselect}
      onNodeEnter={commands.handleNodeEnter}
      onOpenMenu={onOpenBattleMenu}
    />
  );
}

function RewardsScreenRoute({
  commands,
  onOpenBattleMenu,
}: {
  commands: RunLoopCommands["rewards"];
  onOpenBattleMenu: RunLoopRouteCtx["onOpenBattleMenu"];
}) {
  const r = useRewardsScreenData();
  return (
    <RewardsScreen
      rewardState={r.rewardState}
      claimInFlight={r.rewardClaimInFlight}
      onAddReward={commands.finish}
      onSkip={commands.finish}
      onSelectReward={commands.selectChoice}
      onOpenMenu={onOpenBattleMenu}
    />
  );
}

function WildwoodRemovalScreenRoute({
  commands,
  onOpenBattleMenu,
}: {
  commands: RunLoopCommands["wildwood"];
  onOpenBattleMenu: RunLoopRouteCtx["onOpenBattleMenu"];
}) {
  const r = useWildwoodRemovalScreenData();
  return (
    <WildwoodRemovalScreen
      runDeck={r.runDeck}
      onRemove={commands.removeCard}
      onSkip={commands.skipRemoval}
      onOpenMenu={onOpenBattleMenu}
    />
  );
}

function DestinationScreenRoute({
  commands,
  onOpenBattleMenu,
}: {
  commands: RunLoopCommands["destinations"];
  onOpenBattleMenu: RunLoopRouteCtx["onOpenBattleMenu"];
}) {
  const r = useDestinationScreenData();
  return (
    <DestinationScreen
      rewardState={r.rewardState}
      onChoose={commands.choose}
      onPrepare={commands.prepare}
      onOpenMenu={onOpenBattleMenu}
    />
  );
}

function CampfireScreenRoute({
  commands,
  onOpenBattleMenu,
}: {
  commands: RunLoopCommands["destinations"];
  onOpenBattleMenu: RunLoopRouteCtx["onOpenBattleMenu"];
}) {
  const r = useCampfireScreenData();
  const talentEffects = useTalentEffects();
  const healFraction = getCampfireHealFraction(talentEffects.campfireHealBonus);
  return (
    <CampfireScreen
      playerHealth={r.runPlayerHealth}
      maxHealth={r.runMaxHealth}
      healFraction={healFraction}
      onContinue={commands.continueCampfire}
      onOpenMenu={onOpenBattleMenu}
    />
  );
}

interface ShopRouteProps<Commands> {
  commands: Commands;
  onOpenBattleMenu: RunLoopRouteCtx["onOpenBattleMenu"];
}

function createShopScreenRoute<Data, Commands>({
  useData,
  render,
}: {
  useData: () => Data;
  render: (data: Data, commands: Commands, onOpenBattleMenu: RunLoopRouteCtx["onOpenBattleMenu"]) => ReactNode;
}) {
  return function ShopScreenRoute({ commands, onOpenBattleMenu }: ShopRouteProps<Commands>) {
    return render(useData(), commands, onOpenBattleMenu);
  };
}

const MerchantShopScreenRoute = createShopScreenRoute({
  useData: useShopScreenData,
  render: (r, commands: RunLoopCommands["shop"]["merchant"], onOpenBattleMenu) => (
    <MerchantShopScreen
      gold={r.gold}
      runDeck={r.runDeck}
      shopCards={r.shopState.cards}
      refreshesLeft={r.shopState.refreshesLeft}
      removeUsed={r.shopState.removeUsed}
      purchasedSlotKeys={r.shopState.purchasedSlotKeys}
      getCardPrice={commands.getCardBuyPrice}
      removePrice={commands.getRemoveCardPrice()}
      refreshPrice={commands.getRefreshPrice(r.shopState.refreshesLeft)}
      onBuyCard={commands.handleBuyCard}
      onRemoveCard={commands.handleRemoveCard}
      onRefresh={commands.handleRefresh}
      onContinue={commands.handleContinue}
      onOpenMenu={onOpenBattleMenu}
    />
  ),
});

const AlchemistShopScreenRoute = createShopScreenRoute({
  useData: useAlchemistScreenData,
  render: (r, commands: RunLoopCommands["shop"]["alchemist"], onOpenBattleMenu) => (
    <AlchemistShopScreen
      gold={r.gold}
      runDeck={r.runDeck}
      potionCards={r.alchemistState.potions}
      refreshesLeft={r.alchemistState.refreshesLeft}
      mixUsed={r.alchemistState.mixUsed}
      purchasedSlotKeys={r.alchemistState.purchasedSlotKeys}
      getPotionPrice={commands.getPotionBuyPrice}
      mixPrice={commands.getMixPrice()}
      refreshPrice={commands.getRefreshPrice(r.alchemistState.refreshesLeft)}
      onBuyCard={commands.handleBuyCard}
      onRefresh={commands.handleRefresh}
      onMixPotions={commands.handleMixPotions}
      onContinue={commands.handleContinue}
      onOpenMenu={onOpenBattleMenu}
    />
  ),
});

const TrinketShopScreenRoute = createShopScreenRoute({
  useData: useTrinketShopScreenData,
  render: (r, commands: RunLoopCommands["shop"]["trinket"], onOpenBattleMenu) => (
    <TrinketShopScreen
      gold={r.gold}
      trinkets={r.trinketShopState.trinkets}
      refreshesLeft={r.trinketShopState.refreshesLeft}
      purchasedSlotKeys={r.trinketShopState.purchasedSlotKeys}
      getTrinketPrice={commands.getBuyPrice}
      refreshPrice={commands.getRefreshPrice(r.trinketShopState.refreshesLeft)}
      onBuyTrinket={commands.handleBuy}
      onRefresh={commands.handleRefresh}
      onContinue={commands.handleContinue}
      onOpenMenu={onOpenBattleMenu}
    />
  ),
});

const EquipmentShopScreenRoute = createShopScreenRoute({
  useData: useEquipmentShopScreenData,
  render: (r, commands: RunLoopCommands["shop"]["equipment"], onOpenBattleMenu) => (
    <EquipmentShopScreen
      gold={r.gold}
      gear={r.equipmentShopState.gear}
      refreshesLeft={r.equipmentShopState.refreshesLeft}
      purchasedSlotKeys={r.equipmentShopState.purchasedSlotKeys}
      getGearPrice={commands.getBuyPrice}
      refreshPrice={commands.getRefreshPrice(r.equipmentShopState.refreshesLeft)}
      onBuyGear={commands.handleBuy}
      onRefresh={commands.handleRefresh}
      onContinue={commands.handleContinue}
      onOpenMenu={onOpenBattleMenu}
    />
  ),
});

function createRunLoopRoute<Commands>(
  select: (commands: RunLoopCommands) => Commands,
  render: (commands: Commands, onOpenBattleMenu: RunLoopRouteCtx["onOpenBattleMenu"]) => ReactNode,
) {
  return ({ routeCommands, onOpenBattleMenu }: RunLoopRouteCtx) =>
    render(select(routeCommands.runLoop), onOpenBattleMenu);
}

function CorruptionScreenRoute({
  commands,
  onOpenBattleMenu,
}: {
  commands: RunLoopCommands["corruption"];
  onOpenBattleMenu: RunLoopRouteCtx["onOpenBattleMenu"];
}) {
  const r = useCorruptionScreenData();
  return (
    <CorruptionScreen
      runDeck={r.runDeck}
      result={r.corruptionResult}
      onCorrupt={commands.handleCorruptCard}
      onExit={commands.handleExit}
      onOpenMenu={onOpenBattleMenu}
    />
  );
}

export const runLoopScreenRoutes: {
  battle: (ctx: BattleRouteCtx) => ReactNode;
  "labyrinth-map": (ctx: RunLoopRouteCtx) => ReactNode;
  rewards: (ctx: RunLoopRouteCtx) => ReactNode;
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
  battle: ({ routeCommands, onOpenBattleMenu, gameMenuOpen }) => (
    <BattleScreenRoute
      commands={routeCommands.battle}
      onOpenBattleMenu={onOpenBattleMenu}
      gameMenuOpen={gameMenuOpen}
    />
  ),
  "labyrinth-map": createRunLoopRoute(
    (commands) => commands.labyrinth,
    (commands, onOpenBattleMenu) => <LabyrinthMapScreenRoute commands={commands} onOpenBattleMenu={onOpenBattleMenu} />,
  ),
  rewards: createRunLoopRoute(
    (commands) => commands.rewards,
    (commands, onOpenBattleMenu) => <RewardsScreenRoute commands={commands} onOpenBattleMenu={onOpenBattleMenu} />,
  ),
  "wildwood-removal": createRunLoopRoute(
    (commands) => commands.wildwood,
    (commands, onOpenBattleMenu) => (
      <WildwoodRemovalScreenRoute commands={commands} onOpenBattleMenu={onOpenBattleMenu} />
    ),
  ),
  destination: createRunLoopRoute(
    (commands) => commands.destinations,
    (commands, onOpenBattleMenu) => <DestinationScreenRoute commands={commands} onOpenBattleMenu={onOpenBattleMenu} />,
  ),
  campfire: createRunLoopRoute(
    (commands) => commands.destinations,
    (commands, onOpenBattleMenu) => <CampfireScreenRoute commands={commands} onOpenBattleMenu={onOpenBattleMenu} />,
  ),
  shop: createRunLoopRoute(
    (commands) => commands.shop.merchant,
    (commands, onOpenBattleMenu) => <MerchantShopScreenRoute commands={commands} onOpenBattleMenu={onOpenBattleMenu} />,
  ),
  alchemist: createRunLoopRoute(
    (commands) => commands.shop.alchemist,
    (commands, onOpenBattleMenu) => (
      <AlchemistShopScreenRoute commands={commands} onOpenBattleMenu={onOpenBattleMenu} />
    ),
  ),
  "trinket-shop": createRunLoopRoute(
    (commands) => commands.shop.trinket,
    (commands, onOpenBattleMenu) => <TrinketShopScreenRoute commands={commands} onOpenBattleMenu={onOpenBattleMenu} />,
  ),
  "equipment-shop": createRunLoopRoute(
    (commands) => commands.shop.equipment,
    (commands, onOpenBattleMenu) => (
      <EquipmentShopScreenRoute commands={commands} onOpenBattleMenu={onOpenBattleMenu} />
    ),
  ),
  mystery: createRunLoopRoute(
    (commands) => commands.mystery,
    (commands, onOpenBattleMenu) => <MysteryScreenRoute commands={commands} onOpenBattleMenu={onOpenBattleMenu} />,
  ),
  corruption: createRunLoopRoute(
    (commands) => commands.corruption,
    (commands, onOpenBattleMenu) => <CorruptionScreenRoute commands={commands} onOpenBattleMenu={onOpenBattleMenu} />,
  ),
};
