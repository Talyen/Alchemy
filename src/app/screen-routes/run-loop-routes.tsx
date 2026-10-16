import { TransmutationScreen } from "@/features/alchemy/run-loop/screens/transmutation-screen";
import { labyrinthCampfireHealing } from "@/lib/content-systems/labyrinth/room-rules";
import { useEffect, useRef } from "react";
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
import { useRunScreenData } from "@/features/alchemy/shared/stores/use-run-screen-data";
import { useHomesteadEffects } from "@/features/alchemy/shared/stores/use-run-reads";
import { CAMPFIRE_HEAL_FRACTION } from "@/lib/game-constants";
import type { BattleRouteCtx, RunLoopRouteCtx } from "./route-ctx";

function BattleScreenRoute({ cardInspection, routeCommands, gameMenuOpen }: BattleRouteCtx) {
  const commands = routeCommands.battle;
  const { characterId, heroArt, playerName, aspectMode, stagePixelRatio } = useAppScreenChrome();
  const { battleScreenData, inputBattleState, hasActiveBattle } = useBattleScreenRouteData(commands.presentation);
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
    battleState: inputBattleState,
    hasActiveBattle,
    gameMenuOpen,
    isAutoplayEnabled: commands.isAutoplayEnabled,
    handleEndTurn: commands.handleEndTurn,
    handleAutoplayCard: commands.handleAutoplayCard,
    handleAutoplayWish: commands.handleAutoplayWish,
    isCardPlayInProgress: commands.isCardPlayInProgress,
    isProgressSavePending: commands.isProgressSavePending,
    subscribeProgressSave: commands.subscribeProgressSave,
    bindPlayback: commands.bindPlayback,
  });

  return (
    <>
      <BattleScreen
        presentation={commands.presentation}
        onInspectEnemy={inspectEnemy}
        enemyInspectionOpen={enemyInspectionOpen}
        battleScreenData={battleScreenData}
        characterId={characterId}
        heroArt={heroArt}
        playerName={playerName}
        aspectMode={aspectMode}
        stagePixelRatio={stagePixelRatio}
        refs={commands.refs}
        onCardClick={(card, index, event) => commands.handleCardClick(card, index, event, inputBattleState)}
        onWishChoice={(card) => commands.handleWishChoice(card, inputBattleState)}
        boonInspectOpen={commands.boonInspectOpen}
        onCloseBoonInspect={commands.closeBoonInspect}
      />
      <EnemyInspectionOverlay
        open={enemyInspectionOpen && canInspectEnemy}
        entry={battleScreenData.battleState.currentEnemy}
        battleState={battleScreenData.battleState}
        enemyDescriptionContext={battleScreenData.battleState}
        modifiers={battleScreenData.activeLabyrinthModifiers}
        onClose={() => setEnemyInspectionOpen(false)}
        returnFocusRef={returnFocusRef}
      />
    </>
  );
}

function LabyrinthMapScreenRoute({ routeCommands }: RunLoopRouteCtx) {
  const commands = routeCommands.runLoop.labyrinth;
  const r = useRunScreenData("labyrinth-map");
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
  const r = useRunScreenData("rewards");
  return (
    <RewardsScreen
      rewardState={r.rewardState}
      claimInFlight={r.rewardClaimInFlight}
      rewardMaterials={r.rewardMaterials}
      onSkip={commands.skip}
      onClaimReward={commands.claimChoice}
    />
  );
}

function WildwoodRemovalScreenRoute({ routeCommands }: RunLoopRouteCtx) {
  const commands = routeCommands.runLoop.wildwood;
  const r = useRunScreenData("wildwood-removal");
  return <WildwoodRemovalScreen runDeck={r.runDeck} onRemove={commands.removeCard} onSkip={commands.skipRemoval} />;
}

function DestinationScreenRoute({ routeCommands }: RunLoopRouteCtx) {
  const commands = routeCommands.runLoop.destinations;
  const r = useRunScreenData("destination");
  return (
    <DestinationScreen
      rewardState={r.rewardState}
      currentAct={r.currentAct}
      onChoose={commands.choose}
      onPrepare={commands.prepare}
    />
  );
}

function CampfireScreenRoute({ routeCommands }: RunLoopRouteCtx) {
  const commands = routeCommands.runLoop.destinations;
  const r = useRunScreenData("campfire");
  const healingBonus = useHomesteadEffects().homesteadHealing;
  const healFraction = labyrinthCampfireHealing(CAMPFIRE_HEAL_FRACTION, r.modifiers);
  return (
    <CampfireScreen
      playerHealth={r.runPlayerHealth}
      maxHealth={r.runMaxHealth}
      healFraction={healFraction}
      healingBonus={healingBonus}
      modifiers={r.modifiers}
      runDeck={r.runDeck}
      visit={r.visit}
      afterProgressSaved={routeCommands.progress.afterSaved}
      isProgressSavePending={routeCommands.progress.isPending}
      onRest={commands.rest}
      onBrew={commands.brew}
      onContinue={commands.continueCampfire}
    />
  );
}

function CardShopScreenRoute({ routeCommands }: RunLoopRouteCtx) {
  const commands = routeCommands.runLoop.shop.merchant;
  const onContinue = () => routeCommands.runLoop.shop.continue("shop");
  const r = useRunScreenData("shop");
  return (
    <CardShopScreen
      isProgressSavePending={routeCommands.progress.isPending}
      gold={r.gold}
      runDeck={r.runDeck}
      items={r.shopState.cards}
      refreshesLeft={r.shopState.refreshesLeft}
      removeUsed={r.shopState.removeUsed}
      purchasedSlotKeys={r.shopState.purchasedSlotKeys}
      getPrice={commands.getCardBuyPrice}
      removePrice={commands.getRemoveCardPrice()}
      refreshPrice={commands.getRefreshPrice()}
      onBuy={commands.buyCard}
      onRemoveCard={commands.removeCard}
      onRefresh={commands.refresh}
      onContinue={onContinue}
    />
  );
}

function AlchemistShopScreenRoute({ routeCommands }: RunLoopRouteCtx) {
  const commands = routeCommands.runLoop.shop.alchemist;
  const onContinue = () => routeCommands.runLoop.shop.continue("alchemist");
  const r = useRunScreenData("alchemist");
  return (
    <AlchemistShopScreen
      afterProgressSaved={routeCommands.progress.afterSaved}
      isProgressSavePending={routeCommands.progress.isPending}
      gold={r.gold}
      runDeck={r.runDeck}
      items={r.alchemistState.potions}
      refreshesLeft={r.alchemistState.refreshesLeft}
      mixUsed={r.alchemistState.mixUsed}
      purchasedSlotKeys={r.alchemistState.purchasedSlotKeys}
      getPrice={commands.getPotionBuyPrice}
      mixPrice={commands.getMixPrice()}
      refreshPrice={commands.getRefreshPrice()}
      onBuy={commands.buyPotion}
      onRefresh={commands.refresh}
      onMixPotions={commands.mixPotions}
      onStrengthenPotion={commands.strengthenPotion}
      onContinue={onContinue}
    />
  );
}

function TrinketShopScreenRoute({ routeCommands }: RunLoopRouteCtx) {
  const commands = routeCommands.runLoop.shop.trinket;
  const onContinue = () => routeCommands.runLoop.shop.continue("trinket-shop");
  const r = useRunScreenData("trinket-shop");
  return (
    <TrinketShopScreen
      isProgressSavePending={routeCommands.progress.isPending}
      gold={r.gold}
      items={r.trinketShopState.trinkets}
      refreshesLeft={r.trinketShopState.refreshesLeft}
      purchasedSlotKeys={r.trinketShopState.purchasedSlotKeys}
      getPrice={commands.getBuyPrice}
      refreshPrice={commands.getRefreshPrice()}
      onBuy={commands.buy}
      onRefresh={commands.refresh}
      onContinue={onContinue}
    />
  );
}

function EquipmentShopScreenRoute({ routeCommands }: RunLoopRouteCtx) {
  const commands = routeCommands.runLoop.shop.equipment;
  const onContinue = () => routeCommands.runLoop.shop.continue("equipment-shop");
  const r = useRunScreenData("equipment-shop");
  return (
    <EquipmentShopScreen
      isProgressSavePending={routeCommands.progress.isPending}
      gold={r.gold}
      items={r.equipmentShopState.gear}
      refreshesLeft={r.equipmentShopState.refreshesLeft}
      purchasedSlotKeys={r.equipmentShopState.purchasedSlotKeys}
      getPrice={commands.getBuyPrice}
      refreshPrice={commands.getRefreshPrice()}
      onBuy={commands.buy}
      onRefresh={commands.refresh}
      onContinue={onContinue}
    />
  );
}

function CorruptionScreenRoute({ routeCommands }: RunLoopRouteCtx) {
  const commands = routeCommands.runLoop.corruption;
  const r = useRunScreenData("corruption");
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
  const r = useRunScreenData("transmutation");
  return (
    <TransmutationScreen
      afterProgressSaved={routeCommands.progress.afterSaved}
      isProgressSavePending={routeCommands.progress.isPending}
      runDeck={r.runDeck}
      visit={r.visit}
      onSelect={commands.select}
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
