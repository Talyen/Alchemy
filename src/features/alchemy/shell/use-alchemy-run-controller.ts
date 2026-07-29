// Top-level alchemy controller composition hook.
// Depends on run, battle, shop, navigation, talent, persistence-facing, and homestead state.
// Used by App as the single UI-facing API while domain rules stay in smaller controllers.
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import type { BattleControllerBindings } from "./battle-bindings";
import type { CharacterId, DifficultyId, UnlockedTalents, TalentXP } from "@/lib/game-data";
import type { EncounterCombatTraitId, EncounterRewardTraitId } from "@/lib/content-systems/types";
import {
  useRunAdapter,
  useTalentAdapter,
  useHomesteadAdapter,
  createRunRandomSource,
} from "@/features/alchemy/shared/stores/run-session-facade";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import {
  setActiveLabyrinthModifiers,
  setActiveLabyrinthRewardModifiers,
} from "@/features/alchemy/shared/stores/run-session-facade";
import { useBattleController } from "./use-battle-controller";
import { useShopController } from "./use-shop-controller";
import { useRunNavigation } from "./use-run-navigation";
import { useLabyrinthController } from "./use-labyrinth-controller";
import { createLabyrinthNodeRouting } from "./labyrinth-node-routing";
import { useScreenTransitions } from "./use-screen-transitions";
import { useSteamRichPresence } from "./use-steam-rich-presence";
import { restoreRun, unlockAllTalents, useActiveRunScreen } from "@/features/alchemy/shared/stores/run-session-facade";
import { readActiveRunStore } from "@/features/alchemy/shared/stores/run-session-facade";
import type { ActiveRunData } from "@/lib/active-run-session";
import { shouldSurrenderBattleOnEndRun } from "./end-run-policy";
import { createAlchemyRouteCommands, type AlchemyRouteCommands } from "./create-route-commands";

export function useAlchemyRunController({
  initialTalentXP,
  initialUnlockedTalents,
  initialActiveRun,
  autoEndTurn,
  onMarkDifficultyCompleted,
}: {
  initialTalentXP: TalentXP;
  initialUnlockedTalents: UnlockedTalents;
  initialActiveRun: ActiveRunData | null;
  autoEndTurn: boolean;
  onMarkDifficultyCompleted: (characterId: CharacterId, difficultyId: DifficultyId) => void;
}) {
  useLayoutEffect(() => {
    if (readActiveRunStore().initialized) return;
    restoreRun(initialActiveRun, initialTalentXP, initialUnlockedTalents);
  }, [initialActiveRun, initialTalentXP, initialUnlockedTalents]);
  const run = useRunAdapter();
  const talents = useTalentAdapter();
  const homesteadEffects = useHomesteadAdapter();
  const runRandom = useMemo(
    () => ({
      rewards: createRunRandomSource("rewards"),
      destinations: createRunRandomSource("destinations"),
      events: createRunRandomSource("events"),
      shops: createRunRandomSource("shops"),
      world: createRunRandomSource("world"),
    }),
    [],
  );

  const { screen, setScreen } = useActiveRunScreen();
  const { navigateTo, transition, commitPendingTransition, cancelPending } = useScreenTransitions(screen, setScreen);

  const setHoveredCardId = useCallback((id: string | null | ((prev: string | null) => string | null)) => {
    const store = useUiStore.getState();
    store.setHoveredCardId(typeof id === "function" ? id(store.hoveredCardId) : id);
  }, []);
  const applyLabyrinthBattleModifiers = useCallback((modifiers: EncounterCombatTraitId[]) => {
    setActiveLabyrinthModifiers(modifiers);
  }, []);
  const applyLabyrinthRewardModifiers = useCallback((modifiers: EncounterRewardTraitId[]) => {
    setActiveLabyrinthRewardModifiers(modifiers);
  }, []);

  const onBattleVictoryRef = useRef<() => void>(() => {});
  const onBattleDefeatRef = useRef<() => void>(() => {});

  const battle = useBattleController({
    run,
    talents,
    autoEndTurn,
    homesteadEffects,
    screen,
    setHoveredCardId,
    onBattleVictory: () => onBattleVictoryRef.current(),
    onBattleDefeat: () => onBattleDefeatRef.current(),
    rng: runRandom.world,
  });

  const shop = useShopController({ talents, homesteadEffects, rng: runRandom.shops });

  const labyrinth = useLabyrinthController(screen, runRandom.world);

  const nav = useRunNavigation({
    screen,
    navigateTo,
    transition,
    cancelPending,
    onStartBattle: battle.startBattle,
    onStartBossBattle: battle.startBossBattle,
    onStartBossById: battle.startBossById,
    onLabyrinthClearNode: labyrinth.onNodeCleared,
    onLabyrinthFailNode: labyrinth.onNodeFailed,
    onInitShop: shop.initShop,
    onInitAlchemist: shop.initAlchemist,
    onInitTrinketShop: shop.initTrinketShop,
    onInitEquipmentShop: shop.initEquipmentShop,
    onMarkDifficultyCompleted,
    randomSources: runRandom,
  });

  useLayoutEffect(() => {
    onBattleVictoryRef.current = nav.handleBattleVictory;
    onBattleDefeatRef.current = nav.handleBattleDefeat;
  });

  useSteamRichPresence(screen, nav.runPhase, run.characterId);

  function handleBeginLabyrinth() {
    if (
      !(nav.activeRunData && run.contentSystemType === "labyrinth") &&
      !(battle.hasActiveBattle && run.contentSystemType === "labyrinth")
    ) {
      labyrinth.resetMap();
    }
    nav.beginLabyrinth();
  }

  const nodeRouting = useMemo(
    () =>
      createLabyrinthNodeRouting({
        applyLabyrinthBattleModifiers,
        applyLabyrinthRewardModifiers,
        navigateTo,
        labyrinth,
        battle,
        nav,
        shop,
      }),
    [applyLabyrinthBattleModifiers, applyLabyrinthRewardModifiers, navigateTo, labyrinth, battle, nav, shop],
  );

  function handleEndRun() {
    if (shouldSurrenderBattleOnEndRun(screen, battle.hasActiveBattle, run.contentSystemType)) {
      battle.handleEndRun();
      return;
    }
    nav.handleAbandonRun();
  }

  const routeCommands = createAlchemyRouteCommands({
    goToScreen: nav.goToScreen,
    beginCampaign: nav.beginCampaign,
    beginLabyrinth: handleBeginLabyrinth,
    beginWildwood: nav.beginWildwood,
    unlockTalent: talents.unlockTalent,
    resetUnlockedTalents: talents.resetUnlockedTalents,
    handleCharacterSelect: nav.handleCharacterSelect,
    handleDraftComplete: nav.handleDraftComplete,
    handleDraftPick: nav.handleDraftPick,
    handleDifficultySelect: nav.handleDifficultySelect,
    handleBackFromDifficultySelect: nav.handleBackFromDifficultySelect,
    handleLabyrinthNodeEnter: nodeRouting.handleLabyrinthNodeEnter,
    finishRewards: nav.finishRewards,
    selectRewardChoice: nav.selectRewardChoice,
    prepareDestinationScreen: nav.prepareDestinationScreen,
    handleDestinationChoice: nav.handleDestinationChoice,
    handleCampfireContinue: nav.handleCampfireContinue,
    handleWildwoodRecoveryComplete: nav.handleWildwoodRecoveryComplete,
    handleWildwoodRemoveCard: nav.handleWildwoodRemoveCard,
    handleWildwoodSkipRemoval: nav.handleWildwoodSkipRemoval,
    advanceToNextDestination: nav.advanceToNextDestination,
    shop,
    handleMysteryChoice: nav.handleMysteryChoice,
    handleMysteryChooseCard: nav.handleMysteryChooseCard,
    handleMysteryRemoveCard: nav.handleMysteryRemoveCard,
    handleMysteryContinue: nav.handleMysteryContinue,
    handleCorruptCard: nav.handleCorruptCard,
    handleCorruptionExit: nav.handleCorruptionExit,
    handleCardClick: battle.handleCardClick,
    handleWishChoice: battle.handleWishChoice,
    handleEndTurn: battle.handleEndTurn,
    skipCombatDevMode: battle.skipCombatDevMode,
    removeCardGhost: battle.removeCardGhost,
    continueFromRunEnd: nav.continueFromRunEnd,
  });

  const battleBindings = useMemo<BattleControllerBindings>(
    () => ({
      battleScreenData: battle.battleScreenData,
      handCardRefs: battle.handCardRefs,
      drawPileRef: battle.drawPileRef,
      discardPileRef: battle.discardPileRef,
      battleSceneRef: battle.battleSceneRef,
      playerPanelRef: battle.playerPanelRef,
      enemyPanelRef: battle.enemyPanelRef,
      cardTransfers: battle.cardTransfers,
      hiddenHandCardKeys: battle.hiddenHandCardKeys,
      cardTransferInProgress: battle.cardTransferInProgress,
      playableHandCardKeys: battle.playableHandCardKeys,
    }),
    [
      battle.battleScreenData,
      battle.cardTransfers,
      battle.hiddenHandCardKeys,
      battle.cardTransferInProgress,
      battle.playableHandCardKeys,
      battle.handCardRefs,
      battle.drawPileRef,
      battle.discardPileRef,
      battle.battleSceneRef,
      battle.playerPanelRef,
      battle.enemyPanelRef,
    ],
  );

  return {
    screen,
    commitPendingTransition,
    routeCommands,
    battleBindings,
    unlockAllTalents,
    returnToBattle: nav.returnToBattle,
    goToScreen: nav.goToScreen,
    handleEndRun,
    resetRunState: nav.resetRunState,
  };
}

type AlchemyRunController = ReturnType<typeof useAlchemyRunController>;
export type { AlchemyRouteCommands };
export type AlchemyRunCommands = AlchemyRunController;
