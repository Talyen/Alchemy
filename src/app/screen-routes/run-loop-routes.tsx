import { useEffect, useRef, type ReactNode } from "react";
import { useHeldWhile } from "@/features/alchemy/shared/ui/fade-presence";
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
  MysteryScreenShell,
  RewardsScreen,
  TrinketShopScreen,
  WildwoodRecoveryScreen,
  WildwoodRemovalScreen,
} from "@/features/alchemy/run-loop/screens";
import { useBattleScreenRouteData } from "@/app/screen-routes/use-battle-screen-route-data";
import {
  useAlchemistScreenData,
  useCampfireScreenData,
  useCorruptionScreenData,
  useDestinationScreenData,
  useEquipmentShopScreenData,
  useLabyrinthMapScreenData,
  useMysteryScreenData,
  useRewardsScreenData,
  useShopScreenData,
  useTrinketShopScreenData,
  useWildwoodRecoveryScreenData,
  useWildwoodRemovalScreenData,
} from "@/features/alchemy/shared/stores/use-run-screen-data";
import { useIsWildwoodRun, useTalentEffects } from "@/features/alchemy/shared/stores/run-session-react-ports";
import { getCampfireHealFraction } from "@/lib/game-constants";
import type { BattleCommands, BattleRouteCtx, RunLoopCommands, RunLoopRouteCtx } from "./route-ctx";

function BattleScreenRoute({
  commands,
  onOpenBattleMenu,
}: {
  commands: BattleCommands;
  onOpenBattleMenu: BattleRouteCtx["onOpenBattleMenu"];
}) {
  const { heroArt, playerName, aspectMode, stagePixelRatio } = useAppScreenChrome();
  const { battleScreenData, hiddenHandCardKeys, cardTransferInProgress, playableHandCardKeys } =
    useBattleScreenRouteData();

  return (
    <BattleScreen
      battleScreenData={battleScreenData}
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
      hiddenHandCardKeys={hiddenHandCardKeys}
      cardTransferInProgress={cardTransferInProgress}
      playableHandCardKeys={playableHandCardKeys}
      isAutoplayEnabled={commands.isAutoplayEnabled}
      onToggleAutoplay={commands.toggleAutoplay}
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
      onNodeClick={commands.handleNodeEnter}
      onOpenMenu={onOpenBattleMenu}
    />
  );
}

function RewardsScreenRoute({ commands }: { commands: RunLoopCommands["rewards"] }) {
  const r = useRewardsScreenData();
  const isWildwood = useIsWildwoodRun();
  return (
    <RewardsScreen
      rewardState={r.rewardState}
      claimInFlight={r.rewardClaimInFlight}
      onAddReward={commands.finish}
      onSkip={commands.finish}
      onSelectReward={commands.selectChoice}
      allowTrinketSkip={isWildwood}
    />
  );
}

function WildwoodRecoveryScreenRoute({ commands }: { commands: RunLoopCommands["wildwood"] }) {
  const r = useWildwoodRecoveryScreenData();
  return (
    <WildwoodRecoveryScreen
      playerHealth={r.runPlayerHealth}
      maxHealth={r.runMaxHealth}
      onComplete={commands.completeRecovery}
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

function ShopScreenRoute({ commands }: { commands: RunLoopCommands["shop"]["merchant"] }) {
  const r = useShopScreenData();
  return (
    <MerchantShopScreen
      gold={r.runGold}
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

function AlchemistScreenRoute({ commands }: { commands: RunLoopCommands["shop"]["alchemist"] }) {
  const r = useAlchemistScreenData();
  return (
    <AlchemistShopScreen
      gold={r.runGold}
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
      gold={r.runGold}
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
      gold={r.runGold}
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

function MysteryScreenRoute({ commands }: { commands: RunLoopCommands["mystery"] }) {
  const r = useMysteryScreenData();
  const { handleContinue } = commands;
  const autoContinueAttemptedRef = useRef(false);
  const heldEvent = useHeldWhile(Boolean(r.mysteryEvent), r.mysteryEvent);

  useEffect(() => {
    if (r.mysteryEvent) {
      autoContinueAttemptedRef.current = false;
      return;
    }
    if (autoContinueAttemptedRef.current) return;
    autoContinueAttemptedRef.current = true;
    handleContinue();
  }, [r.mysteryEvent, handleContinue]);

  if (!heldEvent) {
    return <MysteryScreenShell />;
  }

  return (
    <MysteryScreen
      event={heldEvent}
      runDeck={r.runDeck}
      mysteryCardChoices={r.mysteryCardChoices}
      mysteryGrantedTrinketIds={r.mysteryGrantedTrinketIds}
      onChoose={commands.handleChoice}
      onChooseCard={commands.handleChooseCard}
      onRemoveCard={commands.handleRemoveCard}
      onContinue={commands.handleContinue}
      findCard={(id) => cardLibrary.find((c) => c.id === id)}
      findTrinket={(id) => trinketLibrary.find((t) => t.id === id)}
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
  battle: ({ routeCommands, onOpenBattleMenu }) => (
    <BattleScreenRoute commands={routeCommands.battle} onOpenBattleMenu={onOpenBattleMenu} />
  ),
  "labyrinth-map": ({ routeCommands, onOpenBattleMenu }) => (
    <LabyrinthMapScreenRoute commands={routeCommands.runLoop.labyrinth} onOpenBattleMenu={onOpenBattleMenu} />
  ),
  rewards: ({ routeCommands }) => <RewardsScreenRoute commands={routeCommands.runLoop.rewards} />,
  "wildwood-recovery": ({ routeCommands }) => <WildwoodRecoveryScreenRoute commands={routeCommands.runLoop.wildwood} />,
  "wildwood-removal": ({ routeCommands }) => <WildwoodRemovalScreenRoute commands={routeCommands.runLoop.wildwood} />,
  destination: ({ routeCommands }) => <DestinationScreenRoute commands={routeCommands.runLoop.destinations} />,
  campfire: ({ routeCommands }) => <CampfireScreenRoute commands={routeCommands.runLoop.destinations} />,
  shop: ({ routeCommands }) => <ShopScreenRoute commands={routeCommands.runLoop.shop.merchant} />,
  alchemist: ({ routeCommands }) => <AlchemistScreenRoute commands={routeCommands.runLoop.shop.alchemist} />,
  "trinket-shop": ({ routeCommands }) => <TrinketShopScreenRoute commands={routeCommands.runLoop.shop.trinket} />,
  "equipment-shop": ({ routeCommands }) => <EquipmentShopScreenRoute commands={routeCommands.runLoop.shop.equipment} />,
  mystery: ({ routeCommands }) => <MysteryScreenRoute commands={routeCommands.runLoop.mystery} />,
  corruption: ({ routeCommands }) => <CorruptionScreenRoute commands={routeCommands.runLoop.corruption} />,
};
