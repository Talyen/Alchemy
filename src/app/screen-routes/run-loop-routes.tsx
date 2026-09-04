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
  gameMenuOpen,
}: {
  commands: BattleCommands;
  gameMenuOpen: BattleRouteCtx["gameMenuOpen"];
}) {
  const { characterId, heroArt, playerName, aspectMode, stagePixelRatio } = useAppScreenChrome();
  const { battleScreenData, hasActiveBattle } = useBattleScreenRouteData();
  const { bind } = useBattlePlayback({
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
      onWishChoice={commands.handleWishChoice}
      onSkipCombatDevMode={commands.skipCombatDevMode}
      onEndTurn={commands.handleEndTurn}
    />
  );
}

function LabyrinthMapScreenRoute({ commands }: { commands: RunLoopCommands["labyrinth"] }) {
  const r = useLabyrinthMapScreenData();
  return (
    <LabyrinthMapScreen
      labyrinthMap={r.labyrinthMap}
      selectedNodeId={r.selectedLabyrinthNodeId}
      onNodeSelect={commands.handleNodeSelect}
      onNodeDeselect={commands.handleNodeDeselect}
      onNodeEnter={commands.handleNodeEnter}
    />
  );
}

function RewardsScreenRoute({ commands }: { commands: RunLoopCommands["rewards"] }) {
  const r = useRewardsScreenData();
  return (
    <RewardsScreen
      rewardState={r.rewardState}
      claimInFlight={r.rewardClaimInFlight}
      onAddReward={commands.finish}
      onSkip={commands.finish}
      onSelectReward={commands.selectChoice}
    />
  );
}

function WildwoodRemovalScreenRoute({ commands }: { commands: RunLoopCommands["wildwood"] }) {
  const r = useWildwoodRemovalScreenData();
  return <WildwoodRemovalScreen runDeck={r.runDeck} onRemove={commands.removeCard} onSkip={commands.skipRemoval} />;
}

function DestinationScreenRoute({ commands }: { commands: RunLoopCommands["destinations"] }) {
  const r = useDestinationScreenData();
  return <DestinationScreen rewardState={r.rewardState} onChoose={commands.choose} onPrepare={commands.prepare} />;
}

function CampfireScreenRoute({ commands }: { commands: RunLoopCommands["destinations"] }) {
  const r = useCampfireScreenData();
  const talentEffects = useTalentEffects();
  const healFraction = getCampfireHealFraction(talentEffects.campfireHealBonus);
  return (
    <CampfireScreen
      playerHealth={r.runPlayerHealth}
      maxHealth={r.runMaxHealth}
      healFraction={healFraction}
      onContinue={commands.continueCampfire}
    />
  );
}

interface ShopRouteProps<Commands> {
  commands: Commands;
}

function createShopScreenRoute<Data, Commands>({
  useData,
  render,
}: {
  useData: () => Data;
  render: (data: Data, commands: Commands) => ReactNode;
}) {
  return function ShopScreenRoute({ commands }: ShopRouteProps<Commands>) {
    return render(useData(), commands);
  };
}

const MerchantShopScreenRoute = createShopScreenRoute({
  useData: useShopScreenData,
  render: (r, commands: RunLoopCommands["shop"]["merchant"]) => (
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
    />
  ),
});

const AlchemistShopScreenRoute = createShopScreenRoute({
  useData: useAlchemistScreenData,
  render: (r, commands: RunLoopCommands["shop"]["alchemist"]) => (
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
    />
  ),
});

const TrinketShopScreenRoute = createShopScreenRoute({
  useData: useTrinketShopScreenData,
  render: (r, commands: RunLoopCommands["shop"]["trinket"]) => (
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
    />
  ),
});

const EquipmentShopScreenRoute = createShopScreenRoute({
  useData: useEquipmentShopScreenData,
  render: (r, commands: RunLoopCommands["shop"]["equipment"]) => (
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
    />
  ),
});

function createRunLoopRoute<Commands>(
  select: (commands: RunLoopCommands) => Commands,
  render: (commands: Commands) => ReactNode,
) {
  return ({ routeCommands }: RunLoopRouteCtx) => render(select(routeCommands.runLoop));
}

function CorruptionScreenRoute({ commands }: { commands: RunLoopCommands["corruption"] }) {
  const r = useCorruptionScreenData();
  return (
    <CorruptionScreen
      runDeck={r.runDeck}
      result={r.corruptionResult}
      onCorrupt={commands.handleCorruptCard}
      onExit={commands.handleExit}
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
  battle: ({ routeCommands, gameMenuOpen }) => (
    <BattleScreenRoute commands={routeCommands.battle} gameMenuOpen={gameMenuOpen} />
  ),
  "labyrinth-map": createRunLoopRoute(
    (commands) => commands.labyrinth,
    (commands) => <LabyrinthMapScreenRoute commands={commands} />,
  ),
  rewards: createRunLoopRoute(
    (commands) => commands.rewards,
    (commands) => <RewardsScreenRoute commands={commands} />,
  ),
  "wildwood-removal": createRunLoopRoute(
    (commands) => commands.wildwood,
    (commands) => <WildwoodRemovalScreenRoute commands={commands} />,
  ),
  destination: createRunLoopRoute(
    (commands) => commands.destinations,
    (commands) => <DestinationScreenRoute commands={commands} />,
  ),
  campfire: createRunLoopRoute(
    (commands) => commands.destinations,
    (commands) => <CampfireScreenRoute commands={commands} />,
  ),
  shop: createRunLoopRoute(
    (commands) => commands.shop.merchant,
    (commands) => <MerchantShopScreenRoute commands={commands} />,
  ),
  alchemist: createRunLoopRoute(
    (commands) => commands.shop.alchemist,
    (commands) => <AlchemistShopScreenRoute commands={commands} />,
  ),
  "trinket-shop": createRunLoopRoute(
    (commands) => commands.shop.trinket,
    (commands) => <TrinketShopScreenRoute commands={commands} />,
  ),
  "equipment-shop": createRunLoopRoute(
    (commands) => commands.shop.equipment,
    (commands) => <EquipmentShopScreenRoute commands={commands} />,
  ),
  mystery: createRunLoopRoute(
    (commands) => commands.mystery,
    (commands) => <MysteryScreenRoute commands={commands} />,
  ),
  corruption: createRunLoopRoute(
    (commands) => commands.corruption,
    (commands) => <CorruptionScreenRoute commands={commands} />,
  ),
};
