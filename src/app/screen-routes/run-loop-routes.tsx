import { labyrinthCampfireHealing } from "@/lib/content-systems/labyrinth/room-rules";
import type { ReactNode } from "react";
import { useAppScreenChrome } from "@/app/app-screen-chrome-context";
import {
  AlchemistShopScreen,
  BattleScreen,
  CampfireScreen,
  CorruptionScreen,
  DestinationScreen,
  EquipmentShopScreen,
  LabyrinthMapScreen,
  CardShopScreen,
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
  cardInspection,
  commands,
  gameMenuOpen,
}: {
  cardInspection?: BattleRouteCtx["cardInspection"];
  commands: BattleCommands;
  gameMenuOpen: BattleRouteCtx["gameMenuOpen"];
}) {
  const { characterId, heroArt, playerName, aspectMode, stagePixelRatio } = useAppScreenChrome();
  const { battleScreenData, hasActiveBattle } = useBattleScreenRouteData();
  useBattlePlayback({
    screen: commands.screen,
    battleState: battleScreenData.battleState,
    hasActiveBattle,
    gameMenuOpen,
    isAutoplayEnabled: commands.isAutoplayEnabled,
    handleEndTurn: commands.handleEndTurn,
    handleAutoplayCard: commands.handleAutoplayCard,
    isCardPlayInProgress: commands.isCardPlayInProgress,
    bindPlayback: commands.bindPlayback,
  });

  return (
    <BattleScreen
      onInspectPile={cardInspection?.onOpen}
      inspectionAvailable={cardInspection?.canOpen}
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
      boonInspectOpen={commands.boonInspectOpen}
      onCloseBoonInspect={commands.closeBoonInspect}
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
      onSkip={commands.skip}
      onClaimReward={commands.claimChoice}
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
  const healFraction = labyrinthCampfireHealing(getCampfireHealFraction(talentEffects.campfireHealBonus), r.modifiers);
  return (
    <CampfireScreen
      playerHealth={r.runPlayerHealth}
      maxHealth={r.runMaxHealth}
      healFraction={healFraction}
      onContinue={commands.continueCampfire}
    />
  );
}

function CardShopScreenRoute({ commands }: { commands: RunLoopCommands["shop"]["merchant"] }) {
  const r = useShopScreenData();
  return (
    <CardShopScreen
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
  );
}

function AlchemistShopScreenRoute({ commands }: { commands: RunLoopCommands["shop"]["alchemist"] }) {
  const r = useAlchemistScreenData();
  return (
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
  );
}

function TrinketShopScreenRoute({ commands }: { commands: RunLoopCommands["shop"]["trinket"] }) {
  const r = useTrinketShopScreenData();
  return (
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
  );
}

function EquipmentShopScreenRoute({ commands }: { commands: RunLoopCommands["shop"]["equipment"] }) {
  const r = useEquipmentShopScreenData();
  return (
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
  );
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
  battle: ({ routeCommands, gameMenuOpen, cardInspection }) => (
    <BattleScreenRoute commands={routeCommands.battle} gameMenuOpen={gameMenuOpen} cardInspection={cardInspection} />
  ),
  "labyrinth-map": ({ routeCommands }) => <LabyrinthMapScreenRoute commands={routeCommands.runLoop.labyrinth} />,
  rewards: ({ routeCommands }) => <RewardsScreenRoute commands={routeCommands.runLoop.rewards} />,
  "wildwood-removal": ({ routeCommands }) => <WildwoodRemovalScreenRoute commands={routeCommands.runLoop.wildwood} />,
  destination: ({ routeCommands }) => <DestinationScreenRoute commands={routeCommands.runLoop.destinations} />,
  campfire: ({ routeCommands }) => <CampfireScreenRoute commands={routeCommands.runLoop.destinations} />,
  shop: ({ routeCommands }) => <CardShopScreenRoute commands={routeCommands.runLoop.shop.merchant} />,
  alchemist: ({ routeCommands }) => <AlchemistShopScreenRoute commands={routeCommands.runLoop.shop.alchemist} />,
  "trinket-shop": ({ routeCommands }) => <TrinketShopScreenRoute commands={routeCommands.runLoop.shop.trinket} />,
  "equipment-shop": ({ routeCommands }) => <EquipmentShopScreenRoute commands={routeCommands.runLoop.shop.equipment} />,
  mystery: ({ routeCommands }) => <MysteryScreenRoute commands={routeCommands.runLoop.mystery} />,
  corruption: ({ routeCommands }) => <CorruptionScreenRoute commands={routeCommands.runLoop.corruption} />,
};
