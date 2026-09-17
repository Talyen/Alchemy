import type { AlchemyRouteCommands, AlchemyRunCommands } from "./route-commands";
import { createRunOutcomes } from "@/features/alchemy/run-loop/run/run-flow";
import { createShopActions } from "@/features/alchemy/run-loop/shop/create-shop-actions";
import {
  useActiveRunCharacterId,
  useActiveRunScreenValue,
  useHomesteadEffects,
  useTalentEffects,
} from "@/features/alchemy/shared/stores/run-reads";
import {
  createRunSessionCommand,
  dispatchRunSessionCommand,
} from "@/features/alchemy/shared/stores/run-session-command";
import {
  resetUnlockedTalents,
  setActiveLabyrinthModifiers,
  setActiveLabyrinthRewardModifiers,
  setCorruptionResult,
  unlockAllTalents,
  unlockTalent,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import type { EncounterCombatTraitId, EncounterRewardTraitId } from "@/lib/content-systems/types";
import { useCallback, useMemo } from "react";
import { createLabyrinthNodeRouting } from "./labyrinth-node-routing";
import { clearRunCardHover, readRunAvailableDestinations } from "./run-destination-wiring";
import { useBattleController } from "./use-battle-controller";
import { createLabyrinthController } from "@/features/alchemy/run-loop/run/labyrinth-controller";
import { useRunFlowEngine } from "./use-run-flow-engine";
import { useScreenTransitions } from "./use-screen-transitions";
import { useSteamRichPresence } from "./use-steam-rich-presence";

const commandUnlockTalent = createRunSessionCommand(unlockTalent);
const commandResetUnlockedTalents = createRunSessionCommand(resetUnlockedTalents);
const commandUnlockAllTalents = createRunSessionCommand(unlockAllTalents);

export function useAlchemyRunController(): AlchemyRunCommands {
  const homesteadEffects = useHomesteadEffects();
  const talentEffects = useTalentEffects();
  const characterId = useActiveRunCharacterId();
  const screen = useActiveRunScreenValue();
  const { navigateTo, transition, cancelPending, navigationPending } = useScreenTransitions(screen);

  const setHoveredCardId = useCallback((id: string | null | ((prev: string | null) => string | null)) => {
    const store = useUiStore.getState();
    store.setHoveredCardId(typeof id === "function" ? id(store.hoveredCardId) : id);
  }, []);
  const applyLabyrinthBattleModifiers = useCallback((modifiers: EncounterCombatTraitId[]) => {
    dispatchRunSessionCommand((draft) => {
      // No-op commands preserve revision: skip the write only when already
      // empty, but still clear stale traits with [] so the next node cannot
      // inherit the previous node's combat modifiers.
      if (modifiers.length === 0 && draft.session.activeLabyrinthModifiers.length === 0) return;
      setActiveLabyrinthModifiers(draft, modifiers);
    });
  }, []);
  const applyLabyrinthRewardModifiers = useCallback((modifiers: EncounterRewardTraitId[]) => {
    dispatchRunSessionCommand((draft) => {
      if (modifiers.length === 0 && draft.session.activeLabyrinthRewardModifiers.length === 0) return;
      setActiveLabyrinthRewardModifiers(draft, modifiers);
    });
  }, []);

  const outcomes = useMemo(
    () =>
      createRunOutcomes({
        actions: { navigateTo, transition, clearCardHover: clearRunCardHover },
        getAvailableDestinations: readRunAvailableDestinations,
      }),
    [navigateTo, transition],
  );
  const battle = useBattleController({
    screen,
    setHoveredCardId,
    onBattleVictory: outcomes.victory.handleBattleVictory,
    onBattleDefeat: outcomes.defeat.handleBattleDefeat,
  });

  const gearAstralChanceBonus = homesteadEffects.gearAstralChanceBonus;
  const potionMixPotency = homesteadEffects.potionMixPotency;
  const shop = useMemo(
    () => createShopActions({ talentEffects, homesteadEffects: { gearAstralChanceBonus, potionMixPotency } }),
    [talentEffects, gearAstralChanceBonus, potionMixPotency],
  );

  const labyrinth = useMemo(() => createLabyrinthController(), []);

  const battleLauncher = useMemo(
    () => ({
      onStartBattle: battle.startBattle,
      onStartBossBattle: battle.startBossBattle,
      onStartBossById: battle.startBossById,
    }),
    [battle.startBattle, battle.startBossBattle, battle.startBossById],
  );

  const nav = useRunFlowEngine(
    {
      screen,
      navigateTo,
      transition,
      cancelPending,
      battle: battleLauncher,
      initializeShop: shop.initialize,
      labyrinthClearNode: labyrinth.onNodeCleared,
    },
    outcomes,
  );

  useSteamRichPresence(screen, nav.runPhase, characterId);

  const cancelBattle = battle.cancelBattle;
  const handleAbandonRun = nav.handleAbandonRun;

  const resetCorruptionResult = useCallback(() => {
    dispatchRunSessionCommand((draft) => setCorruptionResult(draft, null));
  }, []);

  const nodeRouting = useMemo(
    () =>
      createLabyrinthNodeRouting({
        applyLabyrinthBattleModifiers,
        applyLabyrinthRewardModifiers,
        navigateTo,
        labyrinth,
        battle: {
          startBattle: battle.startBattle,
          startBossBattle: battle.startBossBattle,
        },
        nav: { beginMysteryEvent: nav.beginMysteryEvent },
        shop,
        corruption: { reset: resetCorruptionResult },
      }),
    [
      applyLabyrinthBattleModifiers,
      applyLabyrinthRewardModifiers,
      navigateTo,
      labyrinth,
      battle.startBattle,
      battle.startBossBattle,
      nav.beginMysteryEvent,
      shop,
      resetCorruptionResult,
    ],
  );

  const handleEndRun = useCallback(() => {
    cancelBattle();
    handleAbandonRun();
  }, [cancelBattle, handleAbandonRun]);

  const routeCommands = useMemo<AlchemyRouteCommands>(
    () => ({
      meta: {
        resumeRun: nav.returnToBattle,
        goToScreen: nav.goToScreen,
        beginCampaign: nav.beginCampaign,
        beginLabyrinth: nav.beginLabyrinth,
        beginWildwood: nav.beginWildwood,
        unlockTalent: commandUnlockTalent,
        resetUnlockedTalents: commandResetUnlockedTalents,
      },
      runSetup: {
        goToScreen: nav.goToScreen,
        handleCharacterSelect: nav.handleCharacterSelect,
        handleStandardDraftComplete: nav.handleStandardDraftComplete,
        handleWildwoodDraftComplete: nav.handleWildwoodDraftComplete,
        handleWildwoodDraftPick: nav.handleWildwoodDraftPick,
        handleStarterDraftPick: nav.handleStarterDraftPick,
        handleDifficultySelect: nav.handleDifficultySelect,
        handleBackFromDifficultySelect: nav.handleBackFromDifficultySelect,
      },
      runLoop: {
        labyrinth: {
          handleNodeSelect: labyrinth.selectNode,
          handleNodeDeselect: labyrinth.deselectNode,
          handleNodeEnter: nodeRouting.handleLabyrinthNodeEnter,
          descend: labyrinth.descend,
        },
        rewards: {
          skip: nav.skipRewards,
          claimChoice: nav.claimRewardChoice,
        },
        destinations: {
          prepare: nav.prepareDestinationScreen,
          choose: nav.handleDestinationChoice,
          continueCampfire: nav.handleCampfireContinue,
        },
        wildwood: {
          removeCard: nav.handleWildwoodRemoveCard,
          skipRemoval: nav.handleWildwoodSkipRemoval,
        },
        shop: { ...shop, continue: nav.advanceToNextDestination },
        mystery: {
          handleChoice: nav.handleMysteryChoice,
          handleChooseCard: nav.handleMysteryChooseCard,
          handleContinue: nav.handleMysteryContinue,
        },
        corruption: {
          handleCorruptCard: nav.handleCorruptCard,
          handleExit: nav.handleCorruptionExit,
        },
      },
      battle,
      runEnd: {
        continueFromRunEnd: nav.continueFromRunEnd,
      },
    }),
    [nav, nodeRouting, labyrinth, shop, battle],
  );

  return {
    screen,
    navigationPending,
    homesteadEffects,
    routeCommands,
    unlockAllTalents: commandUnlockAllTalents,
    returnToBattle: nav.returnToBattle,
    goToScreen: nav.goToScreen,
    handleEndRun,
    resetRunState: nav.resetRunState,
  };
}
