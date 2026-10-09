import { defaultGameSession } from "@/app/application-session";
import { TransmutationScreen } from "@/features/alchemy/run-loop/screens/transmutation-screen";
import { initializeAlchemyVisit } from "@/features/alchemy/run-loop/navigation/alchemy-commands";
import { labyrinthCampfireHealing } from "@/lib/content-systems/labyrinth/room-rules";
import { useEffect, useRef, useState } from "react";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import { EnemyInspectionOverlay } from "@/features/alchemy/shared/ui/inspection/enemy-inspection-overlay";
import {
  readCardAnimationInProgress,
  readPlaybackPresentationGate,
} from "@/features/alchemy/run-loop/battle/presentation/use-hand-presentation";
import { handHasHiddenCard } from "@/features/alchemy/run-loop/battle/playable-hand";
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
  useTransmutationScreenData,
  useCorruptionScreenData,
  useDestinationScreenData,
  useEquipmentShopScreenData,
  useLabyrinthMapScreenData,
  useRewardsScreenData,
  useShopScreenData,
  useTrinketShopScreenData,
  useWildwoodRemovalScreenData,
} from "@/features/alchemy/shared/stores/use-run-screen-data";
import { useHomesteadEffects, useTalentEffects } from "@/features/alchemy/shared/stores/run-reads";
import { getCampfireHealFraction } from "@/lib/campfire-heal";
import type { BattleRouteCtx, RunLoopRouteCtx } from "./route-ctx";

function BattleScreenRoute({ cardInspection, routeCommands, gameMenuOpen }: BattleRouteCtx) {
  const commands = routeCommands.battle;
  const { characterId, heroArt, playerName, aspectMode, stagePixelRatio } = useAppScreenChrome();
  const { battleScreenData, hasActiveBattle } = useBattleScreenRouteData(commands.presentation);
  const enemyInspectionOpen = useUiStore((state) => state.enemyInspectionOpen);
  const setEnemyInspectionOpen = useUiStore((state) => state.setEnemyInspectionOpen);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const canInspectEnemy = Boolean(
    cardInspection?.canOpen &&
    hasActiveBattle &&
    !gameMenuOpen &&
    !commands.boonInspectOpen &&
    commands.screen === "battle",
  );
  // Single effect owns enemy-inspection teardown: close when the inspection gate
  // fails and on unmount (cleanup), so the overlay can't outlive battle identity.
  useEffect(() => {
    if (!canInspectEnemy) setEnemyInspectionOpen(false);
    return () => setEnemyInspectionOpen(false);
  }, [canInspectEnemy, setEnemyInspectionOpen]);
  function inspectEnemy(trigger: HTMLElement) {
    const presentation = readPlaybackPresentationGate(commands.presentation);
    if (
      !canInspectEnemy ||
      commands.isCardPlayInProgress() ||
      readCardAnimationInProgress(commands.presentation) ||
      handHasHiddenCard(battleScreenData.battleState, presentation.hiddenHandCardKeys)
    )
      return;
    returnFocusRef.current = trigger;
    setEnemyInspectionOpen(true);
  }
  useBattlePlayback({
    presentation: commands.presentation,
    screen: commands.screen,
    battleState: battleScreenData.battleState,
    hasActiveBattle,
    gameMenuOpen,
    isAutoplayEnabled: commands.isAutoplayEnabled,
    handleEndTurn: commands.handleEndTurn,
    handleAutoplayCard: commands.handleAutoplayCard,
    handleAutoplayWish: commands.handleAutoplayWish,
    isCardPlayInProgress: commands.isCardPlayInProgress,
    bindPlayback: commands.bindPlayback,
  });

  return (
    <>
      <BattleScreen
        presentation={commands.presentation}
        onInspectEnemy={inspectEnemy}
        enemyInspectionOpen={enemyInspectionOpen}
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
        onEndTurn={commands.handleEndTurn}
        boonInspectOpen={commands.boonInspectOpen}
        onCloseBoonInspect={commands.closeBoonInspect}
      />
      <EnemyInspectionOverlay
        open={enemyInspectionOpen && canInspectEnemy}
        entry={battleScreenData.battleState.currentEnemy}
        modifiers={battleScreenData.activeLabyrinthModifiers}
        onClose={() => setEnemyInspectionOpen(false)}
        returnFocusRef={returnFocusRef}
      />
    </>
  );
}

function LabyrinthMapScreenRoute({ routeCommands }: RunLoopRouteCtx) {
  const commands = routeCommands.runLoop.labyrinth;
  const r = useLabyrinthMapScreenData();
  const { heroArt } = useAppScreenChrome();
  return (
    <LabyrinthMapScreen
      labyrinthMap={r.labyrinthMap}
      heroArt={heroArt}
      selectedNodeId={r.selectedLabyrinthNodeId}
      onNodeSelect={commands.handleNodeSelect}
      onNodeDeselect={commands.handleNodeDeselect}
      onNodeEnter={commands.handleNodeEnter}
      onDescend={commands.descend}
    />
  );
}

function RewardsScreenRoute({ routeCommands }: RunLoopRouteCtx) {
  const commands = routeCommands.runLoop.rewards;
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

function WildwoodRemovalScreenRoute({ routeCommands }: RunLoopRouteCtx) {
  const commands = routeCommands.runLoop.wildwood;
  const r = useWildwoodRemovalScreenData();
  return <WildwoodRemovalScreen runDeck={r.runDeck} onRemove={commands.removeCard} onSkip={commands.skipRemoval} />;
}

function DestinationScreenRoute({ routeCommands }: RunLoopRouteCtx) {
  const commands = routeCommands.runLoop.destinations;
  const r = useDestinationScreenData();
  return <DestinationScreen rewardState={r.rewardState} onChoose={commands.choose} onPrepare={commands.prepare} />;
}

function CampfireScreenRoute({ routeCommands }: RunLoopRouteCtx) {
  const commands = routeCommands.runLoop.destinations;
  const r = useCampfireScreenData();
  useEffect(() => initializeAlchemyVisit("campfire", defaultGameSession), []);
  const healingBonus = useHomesteadEffects().homesteadHealing;
  const talentEffects = useTalentEffects();
  const healFraction = labyrinthCampfireHealing(getCampfireHealFraction(talentEffects.campfireHealBonus), r.modifiers);
  return (
    <CampfireScreen
      playerHealth={r.runPlayerHealth}
      maxHealth={r.runMaxHealth}
      healFraction={healFraction}
      healingBonus={healingBonus}
      modifiers={r.modifiers}
      runDeck={r.runDeck}
      visit={r.visit}
      potency={talentEffects.potionMixPotency}
      onRest={commands.rest}
      onBrew={commands.brew}
      onContinue={commands.continueCampfire}
    />
  );
}

function CardShopScreenRoute({ routeCommands }: RunLoopRouteCtx) {
  const commands = routeCommands.runLoop.shop.merchant;
  const onContinue = routeCommands.runLoop.shop.continue;
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
      refreshPrice={commands.getRefreshPrice(r.shopState.refreshesLeft, undefined, r.shopState.freeRefreshUsed)}
      onBuyCard={commands.buyCard}
      onRemoveCard={commands.removeCard}
      onRefresh={commands.refresh}
      onContinue={onContinue}
    />
  );
}

function AlchemistShopScreenRoute({ routeCommands }: RunLoopRouteCtx) {
  const commands = routeCommands.runLoop.shop.alchemist;
  const onContinue = routeCommands.runLoop.shop.continue;
  const r = useAlchemistScreenData();
  const potency = useTalentEffects().potionMixPotency;
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
      refreshPrice={commands.getRefreshPrice(
        r.alchemistState.refreshesLeft,
        undefined,
        r.alchemistState.freeRefreshUsed,
      )}
      onBuyCard={commands.buyPotion}
      onRefresh={commands.refresh}
      onMixPotions={commands.mixPotions}
      onStrengthenPotion={commands.strengthenPotion}
      potency={potency}
      onContinue={onContinue}
    />
  );
}

function TrinketShopScreenRoute({ routeCommands }: RunLoopRouteCtx) {
  const commands = routeCommands.runLoop.shop.trinket;
  const onContinue = routeCommands.runLoop.shop.continue;
  const r = useTrinketShopScreenData();
  return (
    <TrinketShopScreen
      gold={r.gold}
      trinkets={r.trinketShopState.trinkets}
      refreshesLeft={r.trinketShopState.refreshesLeft}
      purchasedSlotKeys={r.trinketShopState.purchasedSlotKeys}
      getTrinketPrice={commands.getBuyPrice}
      refreshPrice={commands.getRefreshPrice(
        r.trinketShopState.refreshesLeft,
        undefined,
        r.trinketShopState.freeRefreshUsed,
      )}
      onBuyTrinket={commands.buy}
      onRefresh={commands.refresh}
      onContinue={onContinue}
    />
  );
}

function EquipmentShopScreenRoute({ routeCommands }: RunLoopRouteCtx) {
  const commands = routeCommands.runLoop.shop.equipment;
  const onContinue = routeCommands.runLoop.shop.continue;
  const r = useEquipmentShopScreenData();
  return (
    <EquipmentShopScreen
      gold={r.gold}
      gear={r.equipmentShopState.gear}
      refreshesLeft={r.equipmentShopState.refreshesLeft}
      purchasedSlotKeys={r.equipmentShopState.purchasedSlotKeys}
      getGearPrice={commands.getBuyPrice}
      refreshPrice={commands.getRefreshPrice(
        r.equipmentShopState.refreshesLeft,
        undefined,
        r.equipmentShopState.freeRefreshUsed,
      )}
      onBuyGear={commands.buy}
      onRefresh={commands.refresh}
      onContinue={onContinue}
    />
  );
}

function CorruptionScreenRoute({ routeCommands }: RunLoopRouteCtx) {
  const commands = routeCommands.runLoop.corruption;
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

function TransmutationScreenRoute({ routeCommands }: RunLoopRouteCtx) {
  const commands = routeCommands.runLoop.transmutation;
  const r = useTransmutationScreenData();
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    initializeAlchemyVisit("transmutation", defaultGameSession);
    setInitialized(true);
  }, []);
  // Empty offers before initialization do not mean the visit is unusable.
  if (!initialized) return null;
  return (
    <TransmutationScreen
      runDeck={r.runDeck}
      visit={r.visit}
      onExchange={commands.exchange}
      onContinue={commands.continue}
    />
  );
}

export const runLoopScreenRoutes = {
  battle: BattleScreenRoute,
  "labyrinth-map": LabyrinthMapScreenRoute,
  rewards: RewardsScreenRoute,
  "wildwood-removal": WildwoodRemovalScreenRoute,
  destination: DestinationScreenRoute,
  campfire: CampfireScreenRoute,
  shop: CardShopScreenRoute,
  alchemist: AlchemistShopScreenRoute,
  "trinket-shop": TrinketShopScreenRoute,
  "equipment-shop": EquipmentShopScreenRoute,
  mystery: MysteryScreenRoute,
  corruption: CorruptionScreenRoute,
  transmutation: TransmutationScreenRoute,
};
