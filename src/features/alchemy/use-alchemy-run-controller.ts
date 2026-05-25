// Top-level alchemy controller composition hook.
// Depends on run, battle, shop, navigation, talent, persistence-facing, and homestead state.
// Used by App as the single UI-facing API while domain rules stay in smaller controllers.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useMemo } from "react";
import { TimerGroup } from "@/lib/animation/game-timer";
import { useShallow } from "zustand/react/shallow";
import { cardLibrary, trinketLibrary, computeTalentEffects } from "@/lib/game-data";
import type { BattleCard, TrinketEntry } from "@/lib/game-data";
import type { TalentXP } from "@/lib/talents";
import type { HomesteadEffectManifest } from "@/lib/homestead/types";
import type { CharacterId, DifficultyId, UnlockedTalents } from "@/lib/game-data";
import { labyrinthModifiersToDifficulty } from "@/lib/content-systems/labyrinth/modifiers";
import type { LabyrinthModifierKind } from "@/lib/content-systems/types";
import { useRunStore } from "./stores/run-store";
import { useScreenStore } from "./stores/screen-store";
import type { RunStateController } from "./use-run-state";
import type { TalentStateController } from "./use-talent-state";
import { useBattleController } from "./use-battle-controller";
import { useBattleStore } from "./stores/battle-store";
import { useShopController } from "./use-shop-controller";
import { useRunNavigation } from "./use-run-navigation";
import { useLabyrinthController } from "./use-labyrinth-controller";
import type { Destination, Screen } from "./types";
import type { ActiveRunData } from "./run/types";
import { NAVIGATION_DELAY_MS } from "@/lib/game-constants";

const cardLookup = new Map<string, BattleCard>(cardLibrary.map((c) => [c.id, c]));
const trinketLookup = new Map<string, TrinketEntry>(trinketLibrary.map((t) => [t.id, t]));

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
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    useRunStore.getState().initialize(initialActiveRun, initialTalentXP, initialUnlockedTalents);
    useBattleStore.getState().initializeActiveBattle(initialActiveRun?.activeCombat?.battleState ?? null);
    if (initialActiveRun) {
      useScreenStore.getState().setHasActiveRun(true);
      if (initialActiveRun.labyrinthMap) {
        useScreenStore.getState().setLabyrinthMap(initialActiveRun.labyrinthMap);
      }
      if (initialActiveRun.activeCombat) {
        useScreenStore.getState().setActiveLabyrinthModifiers(initialActiveRun.activeCombat.activeLabyrinthModifiers);
        useScreenStore
          .getState()
          .setActiveLabyrinthRewardModifiers(initialActiveRun.activeCombat.activeLabyrinthRewardModifiers);
      }
      if (initialActiveRun.labyrinthPendingNode) {
        useScreenStore.getState().setActiveLabyrinthPendingNode(initialActiveRun.labyrinthPendingNode);
      }
      if (initialActiveRun.currentScreen === "destination" && initialActiveRun.destinationChoices?.length > 0) {
        useScreenStore.getState().setRewardState((prev) => ({
          ...prev,
          destinations: initialActiveRun.destinationChoices as Destination[],
        }));
      }
    }
  }, [initialActiveRun, initialTalentXP, initialUnlockedTalents]);
  const runStoreFields = useRunStore(
    useShallow((s) => ({
      characterId: s.characterId,
      runDeck: s.runDeck,
      runGold: s.runGold,
      runPlayerHealth: s.runPlayerHealth,
      runMaxHealth: s.runMaxHealth,
      roomsEncountered: s.roomsEncountered,
      currentAct: s.currentAct,
      destinationIndexInAct: s.destinationIndexInAct,
      completedDestinations: s.completedDestinations,
      runTrinkets: s.runTrinkets,
      encounteredRunEnemyIds: s.encounteredRunEnemyIds,
      selectedDifficulty: s.selectedDifficulty,
      contentSystemType: s.contentSystemType,
    })),
  );
  const runStoreActions = useRunStore(
    useShallow((s) => ({
      setRunDeck: s.setRunDeck,
      setRunGold: s.setRunGold,
      setRunPlayerHealth: s.setRunPlayerHealth,
      setRunMaxHealth: s.setRunMaxHealth,
      setRoomsEncountered: s.setRoomsEncountered,
      setCurrentAct: s.setCurrentAct,
      setDestinationIndexInAct: s.setDestinationIndexInAct,
      setCompletedDestinations: s.setCompletedDestinations,
      setRunTrinkets: s.setRunTrinkets,
      setEncounteredRunEnemyIds: s.setEncounteredRunEnemyIds,
      setSelectedDifficulty: s.setSelectedDifficulty,
      setContentSystemType: s.setContentSystemType,
      setCharacter: s.setCharacter,
      reset: s.reset,
      addRunGold: s.addRunGold,
    })),
  );
  const talentStore = useRunStore(
    useShallow((s) => ({
      talentXP: s.talentXP,
      runTalentXP: s.runTalentXP,
      unlockedTalents: s.unlockedTalents,
      awardCardXP: s.awardCardXP,
      unlockTalent: s.unlockTalent,
      unlockAllTalents: s.unlockAllTalents,
      resetUnlockedTalents: s.resetUnlockedTalents,
      resetRunXP: s.resetRunXP,
      clearPermanentData: s.clearPermanentData,
      awardMysteryXP: s.awardMysteryXP,
    })),
  );
  const talentEffects = useMemo(() => computeTalentEffects(talentStore.unlockedTalents), [talentStore.unlockedTalents]);

  // Adapter objects matching previous useRunState/useTalentState interfaces
  const run: RunStateController = useMemo(
    () => ({ ...runStoreFields, ...runStoreActions }),
    [runStoreFields, runStoreActions],
  );
  const talents: TalentStateController = useMemo(
    () => ({ ...talentStore, talentEffects }),
    [talentStore, talentEffects],
  );

  // ============ Shared State ============
  const [screen, setScreen] = useState<Screen>("menu");
  const hasActiveRun = useScreenStore((s) => s.hasActiveRun);

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
    const store = useScreenStore.getState();
    store.setHoveredCardId(typeof id === "function" ? id(store.hoveredCardId) : id);
  }
  function setActiveLabyrinthModifiers(modifiers: LabyrinthModifierKind[]) {
    useScreenStore.getState().setActiveLabyrinthModifiers(modifiers);
  }
  function setActiveLabyrinthRewardModifiers(modifiers: LabyrinthModifierKind[]) {
    useScreenStore.getState().setActiveLabyrinthRewardModifiers(modifiers);
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

  const labyrinth = useLabyrinthController();

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

  function clearPermanentData() {
    talents.clearPermanentData();
  }

  function handleBeginLabyrinth() {
    if (
      !(hasActiveRun && run.contentSystemType === "labyrinth") &&
      !(battle.hasActiveBattle && run.contentSystemType === "labyrinth")
    ) {
      labyrinth.resetMap();
    }
    nav.beginLabyrinth();
  }

  function handleLabyrinthNodeEnter(row: number, col: number): boolean {
    return labyrinth.enterNode(row, col, {
      onStartBattleWithModifiers: (enemyType, modifiers, rewardModifiers) => {
        setActiveLabyrinthModifiers(modifiers);
        setActiveLabyrinthRewardModifiers(rewardModifiers);
        battle.startBattle(undefined, undefined, enemyType, labyrinthModifiersToDifficulty(modifiers));
        navigateTo("battle");
      },
      onStartBossBattleWithModifiers: (modifiers, rewardModifiers) => {
        setActiveLabyrinthModifiers(modifiers);
        setActiveLabyrinthRewardModifiers(rewardModifiers);
        battle.startBossBattle(labyrinthModifiersToDifficulty(modifiers));
        navigateTo("battle");
      },
      onStartRest: () => {
        setActiveLabyrinthModifiers([]);
        setActiveLabyrinthRewardModifiers([]);
        navigateTo("campfire");
      },
      onStartMystery: () => {
        setActiveLabyrinthModifiers([]);
        setActiveLabyrinthRewardModifiers([]);
        nav.beginMysteryEvent();
      },
      onStartShop: () => {
        setActiveLabyrinthModifiers([]);
        setActiveLabyrinthRewardModifiers([]);
        shop.initShop();
        navigateTo("shop");
      },
      onStartAlchemist: () => {
        setActiveLabyrinthModifiers([]);
        setActiveLabyrinthRewardModifiers([]);
        shop.initAlchemist();
        navigateTo("alchemist");
      },
    });
  }

  return {
    screen,
    commitPendingTransition,
    battleState: battle.battleState,
    hasActiveBattle: battle.hasActiveBattle,
    characterId: run.characterId,
    talentXP: talents.talentXP,
    unlockedTalents: talents.unlockedTalents,
    unlockTalent: talents.unlockTalent,
    unlockAllTalents: talents.unlockAllTalents,
    resetUnlockedTalents: talents.resetUnlockedTalents,
    clearPermanentData,
    get rewardChoices() {
      return nav.rewardChoices;
    },
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
    handleCorruptionContinue: nav.handleCorruptionContinue,
    handleCorruptionLeave: nav.handleCorruptionLeave,
    handleActComplete: nav.handleActComplete,
    handleEndTurn: battle.handleEndTurn,
    cardTransfers: battle.cardTransfers,
    hiddenHandCardKeys: battle.hiddenHandCardKeys,
    cardTransferInProgress: battle.cardTransferInProgress,
    handleEndRun: battle.handleEndRun,
    skipCombatDevMode: battle.skipCombatDevMode,
    removeCardGhost: battle.removeCardGhost,
    resetRunState: nav.resetRunState,
    findCard: (id: string) => cardLookup.get(id),
    findTrinket: (id: string) => trinketLookup.get(id),
  };
}
