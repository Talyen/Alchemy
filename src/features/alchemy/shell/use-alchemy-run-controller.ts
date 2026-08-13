// Top-level alchemy controller composition hook.
// Depends on run, battle, shop, navigation, talent, persistence-facing, and homestead state.
// Used by App as the single UI-facing API while domain rules stay in smaller controllers.
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import type { CharacterId, DifficultyId } from "@/lib/game-data";
import type { EncounterCombatTraitId, EncounterRewardTraitId } from "@/lib/content-systems/types";
import {
  unlockTalent,
  resetUnlockedTalents,
  setActiveLabyrinthModifiers,
  setActiveLabyrinthRewardModifiers,
  unlockAllTalents,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import { useBattleController } from "./use-battle-controller";
import { useShopController } from "./use-shop-controller";
import { useRunFlowEngine } from "./use-run-flow-engine";
import { useLabyrinthController } from "./use-labyrinth-controller";
import { createLabyrinthNodeRouting } from "./labyrinth-node-routing";
import { useScreenTransitions } from "./use-screen-transitions";
import { useSteamRichPresence } from "./use-steam-rich-presence";
import { useActiveRunScreen } from "@/features/alchemy/shared/stores/run-session-react-ports";
import {
  useActiveRunCharacterId,
  useBattleRunPort,
  useBattleTalentPort,
  useContentSystemType,
  useHomesteadEffects,
} from "@/features/alchemy/shared/stores/run-session-react-ports";
import { shouldSurrenderBattleOnEndRun } from "./end-run-policy";
import {
  createRunSessionCommand,
  dispatchRunSessionCommand,
} from "@/features/alchemy/shared/stores/run-session-command";

const commandUnlockTalent = createRunSessionCommand(unlockTalent);
const commandResetUnlockedTalents = createRunSessionCommand(resetUnlockedTalents);
const commandUnlockAllTalents = createRunSessionCommand(unlockAllTalents);

export function useAlchemyRunController({
  autoEndTurn,
  gameMenuOpen,
  onMarkDifficultyCompleted,
}: {
  autoEndTurn: boolean;
  gameMenuOpen: boolean;
  onMarkDifficultyCompleted: (characterId: CharacterId, difficultyId: DifficultyId) => void;
}) {
  // The app bootstrap gate restores the aggregate before this controller mounts.
  const homesteadEffects = useHomesteadEffects();
  const battleRun = useBattleRunPort();
  const battleTalents = useBattleTalentPort();
  const contentSystemType = useContentSystemType();
  const characterId = useActiveRunCharacterId();
  const { screen, setScreen } = useActiveRunScreen();
  const { navigateTo, transition, commitPendingTransition, cancelPending } = useScreenTransitions(screen, setScreen);

  const setHoveredCardId = useCallback((id: string | null | ((prev: string | null) => string | null)) => {
    const store = useUiStore.getState();
    store.setHoveredCardId(typeof id === "function" ? id(store.hoveredCardId) : id);
  }, []);
  const applyLabyrinthBattleModifiers = useCallback((modifiers: EncounterCombatTraitId[]) => {
    dispatchRunSessionCommand((draft) => setActiveLabyrinthModifiers(draft, modifiers));
  }, []);
  const applyLabyrinthRewardModifiers = useCallback((modifiers: EncounterRewardTraitId[]) => {
    dispatchRunSessionCommand((draft) => setActiveLabyrinthRewardModifiers(draft, modifiers));
  }, []);

  // Stable wrappers so battle can be created before nav; assign latest handlers during render.
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
    gameMenuOpen,
    setHoveredCardId,
    onBattleVictory: battleCompletionOps.onBattleVictory,
    onBattleDefeat: battleCompletionOps.onBattleDefeat,
  });

  const shop = useShopController({
    talentEffects: battleTalents.talentEffects,
    homesteadEffects,
  });

  const labyrinth = useLabyrinthController(screen);

  const battleLauncher = useMemo(
    () => ({
      onStartBattle: battle.startBattle,
      onStartBossBattle: battle.startBossBattle,
      onStartBossById: battle.startBossById,
    }),
    [battle.startBattle, battle.startBossBattle, battle.startBossById],
  );

  const nav = useRunFlowEngine({
    screen,
    navigateTo,
    transition,
    cancelPending,
    battle: battleLauncher,
    initializeShop: shop.initialize,
    labyrinthClearNode: labyrinth.onNodeCleared,
    labyrinthFailNode: labyrinth.onNodeFailed,
    onMarkDifficultyCompleted,
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

  const routeCommands = {
    meta: {
      goToScreen: nav.goToScreen,
      beginCampaign: nav.beginCampaign,
      beginLabyrinth: handleBeginLabyrinth,
      beginWildwood: nav.beginWildwood,
      unlockTalent: commandUnlockTalent,
      resetUnlockedTalents: commandResetUnlockedTalents,
    },
    runSetup: {
      goToScreen: nav.goToScreen,
      handleCharacterSelect: nav.handleCharacterSelect,
      handleStandardDraftComplete: nav.handleStandardDraftComplete,
      handleWildwoodDraftComplete: nav.handleWildwoodDraftComplete,
      handleDraftPick: nav.handleDraftPick,
      handleDifficultySelect: nav.handleDifficultySelect,
      handleBackFromDifficultySelect: nav.handleBackFromDifficultySelect,
    },
    runLoop: {
      labyrinth: {
        handleNodeEnter: nodeRouting.handleLabyrinthNodeEnter,
      },
      rewards: {
        finish: nav.finishRewards,
        selectChoice: nav.selectRewardChoice,
      },
      destinations: {
        prepare: nav.prepareDestinationScreen,
        choose: nav.handleDestinationChoice,
        continueCampfire: nav.handleCampfireContinue,
      },
      wildwood: {
        completeRecovery: nav.handleWildwoodRecoveryComplete,
        removeCard: nav.handleWildwoodRemoveCard,
        skipRemoval: nav.handleWildwoodSkipRemoval,
      },
      shop: {
        merchant: {
          handleBuyCard: shop.merchant.buyCard,
          handleRemoveCard: shop.merchant.removeCard,
          handleRefresh: shop.merchant.refresh,
          handleContinue: nav.advanceToNextDestination,
          getCardBuyPrice: shop.merchant.getCardBuyPrice,
          getRemoveCardPrice: shop.merchant.getRemoveCardPrice,
          getRefreshPrice: shop.merchant.getRefreshPrice,
        },
        alchemist: {
          handleBuyCard: shop.alchemist.buyPotion,
          handleRefresh: shop.alchemist.refresh,
          handleMixPotions: shop.alchemist.mixPotions,
          handleContinue: nav.advanceToNextDestination,
          getPotionBuyPrice: shop.alchemist.getPotionBuyPrice,
          getMixPrice: shop.alchemist.getMixPrice,
          getRefreshPrice: shop.alchemist.getRefreshPrice,
        },
        trinket: {
          handleBuy: shop.trinket.buy,
          handleRefresh: shop.trinket.refresh,
          handleContinue: nav.advanceToNextDestination,
          getBuyPrice: shop.trinket.getBuyPrice,
          getRefreshPrice: shop.trinket.getRefreshPrice,
        },
        equipment: {
          handleBuy: shop.equipment.buy,
          handleRefresh: shop.equipment.refresh,
          handleContinue: nav.advanceToNextDestination,
          getBuyPrice: shop.equipment.getBuyPrice,
          getRefreshPrice: shop.equipment.getRefreshPrice,
        },
      },
      mystery: {
        handleChoice: nav.handleMysteryChoice,
        handleChooseCard: nav.handleMysteryChooseCard,
        handleRemoveCard: nav.handleMysteryRemoveCard,
        handleContinue: nav.handleMysteryContinue,
      },
      corruption: {
        handleCorruptCard: nav.handleCorruptCard,
        handleExit: nav.handleCorruptionExit,
      },
    },
    battle: {
      handleCardClick: battle.handleCardClick,
      handleWishChoice: battle.handleWishChoice,
      handleEndTurn: battle.handleEndTurn,
      skipCombatDevMode: battle.skipCombatDevMode,
      removeCardGhost: battle.removeCardGhost,
      isAutoplayEnabled: battle.isAutoplayEnabled,
      toggleAutoplay: battle.toggleAutoplay,
      refs: battle.refs,
    },
    runEnd: {
      continueFromRunEnd: nav.continueFromRunEnd,
    },
  };

  return {
    screen,
    commitPendingTransition,
    routeCommands,
    unlockAllTalents: commandUnlockAllTalents,
    returnToBattle: nav.returnToBattle,
    goToScreen: nav.goToScreen,
    handleEndRun,
    resetRunState: nav.resetRunState,
  };
}

type AlchemyRunController = ReturnType<typeof useAlchemyRunController>;
export type AlchemyRouteCommands = AlchemyRunController["routeCommands"];
export type AlchemyRunCommands = AlchemyRunController;
