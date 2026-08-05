// Top-level alchemy controller composition hook.
// Depends on run, battle, shop, navigation, talent, persistence-facing, and homestead state.
// Used by App as the single UI-facing API while domain rules stay in smaller controllers.
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import type { BattleControllerBindings } from "./battle-bindings";
import type { CharacterId, DifficultyId, UnlockedTalents, TalentXP } from "@/lib/game-data";
import type { EncounterCombatTraitId, EncounterRewardTraitId } from "@/lib/content-systems/types";
import { createRunRandomSource } from "@/features/alchemy/shared/stores/run-session-write-port";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import {
  setActiveLabyrinthModifiers,
  setActiveLabyrinthRewardModifiers,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { useBattleController } from "./use-battle-controller";
import { useShopController } from "./use-shop-controller";
import { useRunNavigation } from "./use-run-navigation";
import { useLabyrinthController } from "./use-labyrinth-controller";
import { createLabyrinthNodeRouting } from "./labyrinth-node-routing";
import { useScreenTransitions } from "./use-screen-transitions";
import { useSteamRichPresence } from "./use-steam-rich-presence";
import { restoreRun } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import { unlockAllTalents } from "@/features/alchemy/shared/stores/run-session-write-port";
import { useActiveRunScreen } from "@/features/alchemy/shared/stores/run-session-react-ports";
import {
  useActiveRunCharacterId,
  useBattleRunPort,
  useBattleTalentPort,
  useContentSystemType,
  useHomesteadEffects,
  useTalentCommandPort,
} from "@/features/alchemy/shared/stores/run-session-react-ports";
import { readRunInitialized } from "@/features/alchemy/shared/stores/run-session-read-port";
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
  // Fallback for tests/harnesses that mount the controller without App bootstrap.
  // Production path restores in App before first paint (see App.tsx).
  useLayoutEffect(() => {
    if (readRunInitialized()) return;
    restoreRun(initialActiveRun, initialTalentXP, initialUnlockedTalents);
  }, [initialActiveRun, initialTalentXP, initialUnlockedTalents]);
  const homesteadEffects = useHomesteadEffects();
  const battleRun = useBattleRunPort();
  const battleTalents = useBattleTalentPort();
  const talentCommands = useTalentCommandPort();
  const contentSystemType = useContentSystemType();
  const characterId = useActiveRunCharacterId();
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

  const battleCompletionRef = useRef<{ onBattleVictory: () => void; onBattleDefeat: () => void }>({
    onBattleVictory: () => {},
    onBattleDefeat: () => {},
  });

  const battleCompletionOps = useMemo(
    () => ({
      onBattleVictory: () => battleCompletionRef.current.onBattleVictory(),
      onBattleDefeat: () => battleCompletionRef.current.onBattleDefeat(),
    }),
    [],
  );

  const battle = useBattleController({
    run: battleRun,
    talents: battleTalents,
    autoEndTurn,
    homesteadEffects,
    screen,
    setHoveredCardId,
    onBattleVictory: battleCompletionOps.onBattleVictory,
    onBattleDefeat: battleCompletionOps.onBattleDefeat,
    rng: runRandom.world,
  });

  const shop = useShopController({
    talentEffects: battleTalents.talentEffects,
    homesteadEffects,
    rng: runRandom.shops,
  });

  const labyrinth = useLabyrinthController(screen, runRandom.world);

  const battleLauncher = useMemo(
    () => ({
      onStartBattle: battle.startBattle,
      onStartBossBattle: battle.startBossBattle,
      onStartBossById: battle.startBossById,
    }),
    [battle.startBattle, battle.startBossBattle, battle.startBossById],
  );

  const labyrinthNavOps = useMemo(
    () => ({
      onLabyrinthClearNode: labyrinth.onNodeCleared,
      onLabyrinthFailNode: labyrinth.onNodeFailed,
    }),
    [labyrinth.onNodeCleared, labyrinth.onNodeFailed],
  );

  const shopNavOps = useMemo(
    () => ({
      onInitShop: shop.initShop,
      onInitAlchemist: shop.initAlchemist,
      onInitTrinketShop: shop.initTrinketShop,
      onInitEquipmentShop: shop.initEquipmentShop,
    }),
    [shop.initShop, shop.initAlchemist, shop.initTrinketShop, shop.initEquipmentShop],
  );

  const nav = useRunNavigation({
    screen,
    navigateTo,
    transition,
    cancelPending,
    battle: battleLauncher,
    labyrinth: labyrinthNavOps,
    shop: shopNavOps,
    onMarkDifficultyCompleted,
    randomSources: runRandom,
  });

  useLayoutEffect(() => {
    battleCompletionRef.current.onBattleVictory = nav.handleBattleVictory;
    battleCompletionRef.current.onBattleDefeat = nav.handleBattleDefeat;
  });

  useSteamRichPresence(screen, nav.runPhase, characterId);

  function handleBeginLabyrinth() {
    if (
      !(nav.activeRunData && contentSystemType === "labyrinth") &&
      !(battle.hasActiveBattle && contentSystemType === "labyrinth")
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
    if (shouldSurrenderBattleOnEndRun(screen, battle.hasActiveBattle, contentSystemType)) {
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
    unlockTalent: talentCommands.unlockTalent,
    resetUnlockedTalents: talentCommands.resetUnlockedTalents,
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
      refs: battle.refs,
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
      battle.refs,
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
