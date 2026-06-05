// Top-level alchemy controller composition hook.
// Depends on run, battle, shop, navigation, talent, persistence-facing, and homestead state.
// Used by App as the single UI-facing API while domain rules stay in smaller controllers.
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { TimerGroup } from "@/lib/animation/game-timer";
import { platform } from "@/lib/platform";
import type { TalentXP } from "@/lib/talents";
import type { HomesteadEffectManifest } from "@/lib/homestead/types";
import type { CharacterId, DifficultyId, UnlockedTalents } from "@/lib/game-data";
import { labyrinthModifiersToDifficulty } from "@/lib/content-systems/labyrinth/modifiers";
import type { LabyrinthModifierKind } from "@/lib/content-systems/types";
import { useRunAdapter, useTalentAdapter } from "@/features/alchemy/stores/run-store";
import { useUiStore } from "@/features/alchemy/stores/ui-store";
import { getSteamRichPresenceLabel } from "@/lib/routing";
import {
  setActiveLabyrinthModifiers,
  setActiveLabyrinthRewardModifiers,
} from "@/features/alchemy/stores/run-session-facade";
import { useBattleController } from "./use-battle-controller";
import { useShopController } from "./use-shop-controller";
import { useRunNavigation } from "./use-run-navigation";
import { useLabyrinthController } from "./use-labyrinth-controller";
import { CONSTANTS, type Screen } from "@/features/alchemy/types";
import type { ActiveRunData } from "@/lib/active-run-session";
import { restoreActiveRunToStores, useActiveRunScreen } from "@/features/alchemy/stores/run-session-facade";
import { readActiveRunStore } from "@/features/alchemy/stores/run-session-read";
import { NAVIGATION_DELAY_MS } from "@/lib/game-constants";

export function useAlchemyRunController({
  discoveredCardIds,
  setDiscoveredCardIds,
  setEncounteredEnemyIds,
  initialTalentXP,
  initialUnlockedTalents,
  initialActiveRun,
  autoEndTurn,
  homesteadEffects,
  onMarkDifficultyCompleted,
}: {
  discoveredCardIds: string[];
  setDiscoveredCardIds: React.Dispatch<React.SetStateAction<string[]>>;
  setEncounteredEnemyIds: React.Dispatch<React.SetStateAction<string[]>>;
  initialTalentXP: TalentXP;
  initialUnlockedTalents: UnlockedTalents;
  initialActiveRun: ActiveRunData | null;
  autoEndTurn: boolean;
  homesteadEffects: HomesteadEffectManifest;
  onMarkDifficultyCompleted: (characterId: CharacterId, difficultyId: DifficultyId) => void;
}) {
  // This hook composes domain controllers and exposes a stable UI API; it intentionally
  // avoids owning combat/shop/navigation rules directly so those modules stay testable.
  // ============ Zustand Stores ============
  // Stores are initialized once on mount.  The deps include initial* props for correctness
  // but the effect body uses a guard ref so it only runs once even if React re-renders with
  // different initial values (which shouldn't happen — these are the bootstrap values).
  useEffect(() => {
    if (readActiveRunStore().initialized) return;
    restoreActiveRunToStores(initialActiveRun, initialTalentXP, initialUnlockedTalents);
  }, [initialActiveRun, initialTalentXP, initialUnlockedTalents]);
  const run = useRunAdapter();
  const talents = useTalentAdapter();

  const { screen, setScreen } = useActiveRunScreen();

  // ============ Screen Navigation ============
  const navTimer = useRef(new TimerGroup());
  const pendingTransitionCommitRef = useRef<(() => void) | null>(null);

  const commitPendingTransition = useCallback(() => {
    const commit = pendingTransitionCommitRef.current;
    pendingTransitionCommitRef.current = null;
    commit?.();
  }, []);

  function navigateTo(nextScreen: Screen, onRenderedScreenCommit?: () => void) {
    // Screen changes are delayed for transition pacing, and transition commits wait until
    // the old rendered screen is about to unmount so it cannot flash with next-screen data.
    navTimer.current.clearAll();
    pendingTransitionCommitRef.current = onRenderedScreenCommit ?? null;
    navTimer.current.setTimeout(() => {
      if (nextScreen === screen) {
        commitPendingTransition();
        return;
      }
      setScreen(nextScreen);
    }, NAVIGATION_DELAY_MS);
  }

  // ============ Ref Wrappers ============
  const homesteadEffectsRef = useRef(homesteadEffects);
  useEffect(() => {
    homesteadEffectsRef.current = homesteadEffects;
  }, [homesteadEffects]);

  // ============ Store-backed Setters ============
  function setHoveredCardId(id: string | null | ((prev: string | null) => string | null)) {
    const store = useUiStore.getState();
    store.setHoveredCardId(typeof id === "function" ? id(store.hoveredCardId) : id);
  }
  function applyLabyrinthBattleModifiers(modifiers: LabyrinthModifierKind[]) {
    setActiveLabyrinthModifiers(modifiers);
  }
  function applyLabyrinthRewardModifiers(modifiers: LabyrinthModifierKind[]) {
    setActiveLabyrinthRewardModifiers(modifiers);
  }

  // ============ Domain Controllers ============
  const onBattleVictoryRef = useRef<() => void>(() => {});
  const onBattleDefeatRef = useRef<() => void>(() => {});

  // Refs updated synchronously during render so the latest callbacks are always available
  // for the next user interaction.  Defined before battle because battle depends on these refs.

  const battle = useBattleController({
    run,
    talents,
    discoveredCardIds,
    setDiscoveredCardIds,
    setEncounteredEnemyIds,
    autoEndTurn,
    homesteadEffectsRef,
    screen,
    setHoveredCardId,
    onBattleVictory: () => onBattleVictoryRef.current(),
    onBattleDefeat: () => onBattleDefeatRef.current(),
  });

  const shop = useShopController({
    run,
    talents,
    setDiscoveredCardIds,
  });

  const labyrinth = useLabyrinthController(screen);

  const nav = useRunNavigation({
    screen,
    setScreen,
    navigateTo,
    onStartBattle: battle.startBattle,
    onStartBossBattle: battle.startBossBattle,
    onStartBossById: battle.startBossById,
    onLabyrinthClearNode: labyrinth.onNodeCleared,
    onLabyrinthFailNode: labyrinth.onNodeFailed,
    onInitShop: shop.initShop,
    onInitAlchemist: shop.initAlchemist,
    onMarkDifficultyCompleted,
  });

  // useLayoutEffect ensures refs are current before the browser paints, so any
  // battle callbacks triggered by user interaction always see the latest nav state.
  useLayoutEffect(() => {
    onBattleVictoryRef.current = nav.handleBattleVictory;
    onBattleDefeatRef.current = nav.handleBattleDefeat;
  });

  useEffect(() => {
    platform.steam.setRichPresence("steam_display", getSteamRichPresenceLabel(screen, nav.runPhase, run.characterId));
  }, [screen, nav.runPhase, run.characterId]);

  function clearPermanentData() {
    talents.clearPermanentData();
  }

  function handleBeginLabyrinth() {
    if (
      !(nav.activeRunData && run.contentSystemType === "labyrinth") &&
      !(battle.hasActiveBattle && run.contentSystemType === "labyrinth")
    ) {
      labyrinth.resetMap();
    }
    nav.beginLabyrinth();
  }

  function enterLabyrinthNodeScreen(
    screen: Screen,
    init?: () => void,
    battleModifiers?: LabyrinthModifierKind[],
    rewardModifiers?: LabyrinthModifierKind[],
  ) {
    applyLabyrinthBattleModifiers(battleModifiers ?? []);
    applyLabyrinthRewardModifiers(rewardModifiers ?? []);
    init?.();
    navigateTo(screen);
  }

  function handleLabyrinthNodeEnter(row: number, col: number): boolean {
    return labyrinth.enterNode(row, col, {
      onStartBattleWithModifiers: (enemyType, modifiers, rewardModifiers) => {
        enterLabyrinthNodeScreen(
          CONSTANTS.SCREENS.BATTLE,
          () => {
            battle.startBattle(undefined, undefined, enemyType, labyrinthModifiersToDifficulty(modifiers));
          },
          modifiers,
          rewardModifiers,
        );
      },
      onStartBossBattleWithModifiers: (modifiers, rewardModifiers) => {
        enterLabyrinthNodeScreen(
          CONSTANTS.SCREENS.BATTLE,
          () => {
            battle.startBossBattle(labyrinthModifiersToDifficulty(modifiers));
          },
          modifiers,
          rewardModifiers,
        );
      },
      onStartRest: () => enterLabyrinthNodeScreen(CONSTANTS.SCREENS.CAMPFIRE),
      onStartMystery: () => enterLabyrinthNodeScreen(CONSTANTS.SCREENS.MYSTERY, () => nav.beginMysteryEvent()),
      onStartShop: () => enterLabyrinthNodeScreen(CONSTANTS.SCREENS.SHOP, () => shop.initShop()),
      onStartAlchemist: () => enterLabyrinthNodeScreen(CONSTANTS.SCREENS.ALCHEMIST, () => shop.initAlchemist()),
    });
  }

  return {
    screen,
    runPhase: nav.runPhase,
    pendingCharacterId: nav.pendingCharacterId,
    commitPendingTransition,
    battleState: battle.battleState,
    battleScreenData: battle.battleScreenData,
    hasActiveBattle: battle.hasActiveBattle,
    characterId: run.characterId,
    talentXP: talents.talentXP,
    unlockedTalents: talents.unlockedTalents,
    unlockTalent: talents.unlockTalent,
    unlockAllTalents: talents.unlockAllTalents,
    resetUnlockedTalents: talents.resetUnlockedTalents,
    clearPermanentData,
    rewardState: nav.rewardState,
    get shopCards() {
      return shop.shopCards;
    },
    get alchemistPotions() {
      return shop.alchemistPotions;
    },
    get mysteryEvent() {
      return nav.mysteryEvent;
    },
    get activeRunData() {
      return nav.activeRunData;
    },
    handCardRefs: battle.handCardRefs,
    drawPileRef: battle.drawPileRef,
    discardPileRef: battle.discardPileRef,
    battleSceneRef: battle.battleSceneRef,
    playerPanelRef: battle.playerPanelRef,
    enemyPanelRef: battle.enemyPanelRef,
    beginCampaign: nav.beginCampaign,
    beginLabyrinth: handleBeginLabyrinth,
    beginWildwood: nav.beginWildwood,
    handleLabyrinthNodeEnter,
    handleLabyrinthEndRun: nav.endLabyrinthRun,
    handleCharacterSelect: nav.handleCharacterSelect,
    handleDraftComplete: nav.handleDraftComplete,
    handleDifficultySelect: nav.handleDifficultySelect,
    handleBackFromDifficultySelect: nav.handleBackFromDifficultySelect,
    handleWildwoodBossSelect: nav.handleWildwoodBossSelect,
    returnToBattle: nav.returnToBattle,
    goToScreen: nav.goToScreen,
    handleCardClick: battle.handleCardClick,
    handleWishChoice: battle.handleWishChoice,
    finishRewards: nav.finishRewards,
    selectRewardChoice: nav.selectRewardChoice,
    prepareDestinationScreen: nav.prepareDestinationScreen,
    handleDestinationChoice: nav.handleDestinationChoice,
    handleCampfireContinue: nav.handleCampfireContinue,
    handleShopBuyCard: shop.handleShopBuyCard,
    handleShopRemoveCard: shop.handleShopRemoveCard,
    handleShopRefresh: shop.handleShopRefresh,
    handleShopContinue: nav.advanceToNextDestination,
    handleAlchemistBuyCard: shop.handleAlchemistBuyCard,
    handleAlchemistRefresh: shop.handleAlchemistRefresh,
    handleAlchemistMixPotions: shop.handleAlchemistMixPotions,
    handleAlchemistContinue: nav.advanceToNextDestination,
    handleMysteryChoice: nav.handleMysteryChoice,
    handleMysteryChooseCard: nav.handleMysteryChooseCard,
    handleMysteryRemoveCard: nav.handleMysteryRemoveCard,
    handleMysteryContinue: nav.handleMysteryContinue,
    handleCorruptCard: nav.handleCorruptCard,
    handleCorruptionExit: nav.handleCorruptionExit,
    handleActComplete: nav.handleActComplete,
    handleEndTurn: battle.handleEndTurn,
    cardTransfers: battle.cardTransfers,
    hiddenHandCardKeys: battle.hiddenHandCardKeys,
    cardTransferInProgress: battle.cardTransferInProgress,
    playableHandCardKeys: battle.playableHandCardKeys,
    handleEndRun: battle.handleEndRun,
    skipCombatDevMode: battle.skipCombatDevMode,
    removeCardGhost: battle.removeCardGhost,
    resetRunState: nav.resetRunState,
  };
}
