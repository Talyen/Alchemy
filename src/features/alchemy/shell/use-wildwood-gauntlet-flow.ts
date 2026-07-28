import { useCallback } from "react";
import {
  readRunSessionStore,
  readActiveRunStore,
  setWildwoodDraft,
  setPendingCharacterId,
  type RunStateController,
} from "@/features/alchemy/shared/stores/run-session-facade";
import { teardownRun } from "@/features/alchemy/shared/stores/run-transitions";
import { useProfileStore } from "@/features/alchemy/shared/stores/profile-store";
import { type BattleCard, type DifficultyModifier } from "@/lib/game-data";
import { logError } from "@/lib/error-logger";
import { CONSTANTS, type Screen } from "@/features/alchemy/shared/types";
import { DRAFT_ROUNDS } from "@/lib/game-constants";
import { appendUnique } from "@/lib/utils";
import {
  createWildwoodDraftChoices,
  canOfferWildwoodRemoval,
  drawWildwoodBoss,
  getWildwoodRecoveryHealth,
  pickWildwoodModifier,
  pickWildwoodRewardTrait,
  type WildwoodModifierId,
} from "@/lib/content-systems/wildwood/gauntlet";
import type { VictoryRewardsResult } from "@/features/alchemy/run-loop/navigation/victory-flow";

interface UseWildwoodGauntletFlowOptions {
  run: RunStateController;
  navigateTo: (nextScreen: Screen, onRenderedScreenCommit?: () => void) => void;
  onStartBossById: (
    bossId: string,
    modifiers?: DifficultyModifier[],
    wildwoodModifierId?: WildwoodModifierId,
  ) => boolean;
  setHasActiveBattle: (active: boolean) => void;
  clearCardHover: () => void;
}

export function useWildwoodGauntletFlow({
  run,
  navigateTo,
  onStartBossById,
  setHasActiveBattle,
  clearCardHover,
}: UseWildwoodGauntletFlowOptions) {
  const startNextWildwoodBoss = useCallback(() => {
    const state = readRunSessionStore().wildwoodDraft;
    if (!state) return;
    const draw = drawWildwoodBoss(state.remainingBossIds, state.currentBossId ?? state.previousBossId);
    const modifierId = pickWildwoodModifier();
    const rewardTraitId = pickWildwoodRewardTrait();
    setWildwoodDraft({
      ...state,
      phase: "battle",
      remainingBossIds: draw.remainingBossIds,
      previousBossId: state.currentBossId ?? state.previousBossId,
      currentBossId: draw.bossId,
      currentCombatTraitIds: [modifierId],
      currentRewardTraitIds: [rewardTraitId],
      rewardType: null,
      rewardChoiceIds: [],
      rewardGearChoices: [],
      selectedRewardId: null,
    });
    if (!onStartBossById(draw.bossId, undefined, modifierId)) {
      logError("[useWildwoodGauntletFlow] startNextWildwoodBoss: failed to start boss battle", "other");
      navigateTo(CONSTANTS.SCREENS.MENU, teardownRun);
      return;
    }
    clearCardHover();
    setHasActiveBattle(true);
    navigateTo(CONSTANTS.SCREENS.BATTLE);
  }, [clearCardHover, navigateTo, onStartBossById, setHasActiveBattle]);

  const resumeWildwoodRun = useCallback(() => {
    const state = readRunSessionStore().wildwoodDraft;
    if (!state) {
      navigateTo(CONSTANTS.SCREENS.MENU, teardownRun);
      return;
    }
    if (state.phase === "battle" && state.currentBossId && state.currentCombatTraitIds[0]) {
      if (onStartBossById(state.currentBossId, undefined, state.currentCombatTraitIds[0])) {
        navigateTo(CONSTANTS.SCREENS.BATTLE);
      } else {
        logError("[useWildwoodGauntletFlow] resumeWildwoodRun: failed to resume boss battle", "other");
        navigateTo(CONSTANTS.SCREENS.MENU, teardownRun);
      }
      return;
    }
    if (state.phase === "battle") {
      navigateTo(CONSTANTS.SCREENS.MENU, teardownRun);
      return;
    }
    const routeByPhase = {
      draft: CONSTANTS.SCREENS.DRAFT_DECK,
      recovery: CONSTANTS.SCREENS.WILDWOOD_RECOVERY,
      reward: CONSTANTS.SCREENS.REWARDS,
      removal: CONSTANTS.SCREENS.WILDWOOD_REMOVAL,
    } as const;
    navigateTo(routeByPhase[state.phase]);
  }, [navigateTo, onStartBossById]);

  const handleDraftPick = useCallback(
    (card: BattleCard) => {
      const state = readRunSessionStore().wildwoodDraft;
      if (run.contentSystemType !== CONSTANTS.CONTENT_SYSTEMS.WILDWOOD || state?.phase !== "draft") return;
      const nextDeck = [...run.runDeck, card];
      run.setRunDeck(nextDeck);
      useProfileStore.getState().setDiscoveredCardIds((current) => appendUnique(current, card.id));
      setWildwoodDraft({
        ...state,
        draftChoices: nextDeck.length >= DRAFT_ROUNDS ? [] : createWildwoodDraftChoices(run.characterId, nextDeck),
      });
    },
    [run],
  );

  const handleDraftComplete = useCallback(
    (draftedCards: BattleCard[]) => {
      if (draftedCards.length < DRAFT_ROUNDS) return;
      run.setRunDeck(draftedCards);
      setPendingCharacterId(null);
      startNextWildwoodBoss();
    },
    [run, startNextWildwoodBoss],
  );

  const handleWildwoodRecoveryComplete = useCallback(() => {
    const wildwood = readRunSessionStore().wildwoodDraft;
    if (wildwood?.phase !== "recovery") return;
    const { runPlayerHealth, runMaxHealth, setRunPlayerHealth } = readActiveRunStore();
    setRunPlayerHealth(getWildwoodRecoveryHealth(runPlayerHealth, runMaxHealth));
    setWildwoodDraft({ ...wildwood, phase: "reward" });
    navigateTo(CONSTANTS.SCREENS.REWARDS);
  }, [navigateTo]);

  const handleWildwoodRewardComplete = useCallback(() => {
    const state = readRunSessionStore().wildwoodDraft;
    if (!state) return;
    if (canOfferWildwoodRemoval(readActiveRunStore().runDeck.length)) {
      setWildwoodDraft({
        ...state,
        phase: "removal",
        rewardType: null,
        rewardChoiceIds: [],
        rewardGearChoices: [],
        selectedRewardId: null,
      });
      navigateTo(CONSTANTS.SCREENS.WILDWOOD_REMOVAL);
      return;
    }
    startNextWildwoodBoss();
  }, [navigateTo, startNextWildwoodBoss]);

  const handleWildwoodRemoveCard = useCallback(
    (index: number) => {
      run.setRunDeck((deck) => deck.filter((_, cardIndex) => cardIndex !== index));
      startNextWildwoodBoss();
    },
    [run, startNextWildwoodBoss],
  );

  const handleWildwoodSkipRemoval = useCallback(() => {
    startNextWildwoodBoss();
  }, [startNextWildwoodBoss]);

  const selectRewardChoice = useCallback(
    (id: string) => {
      const state = readRunSessionStore().wildwoodDraft;
      if (run.contentSystemType === CONSTANTS.CONTENT_SYSTEMS.WILDWOOD && state) {
        setWildwoodDraft({ ...state, selectedRewardId: id });
      }
    },
    [run.contentSystemType],
  );

  const commitWildwoodVictory = useCallback((result: VictoryRewardsResult) => {
    const wildwood = readRunSessionStore().wildwoodDraft;
    if (!wildwood) return;
    const rewardType = result.rewardState.rewardType;
    setWildwoodDraft({
      ...wildwood,
      phase: "recovery",
      rewardType,
      rewardChoiceIds: rewardType === "gear" ? [] : result.rewardState.choices.map((choice) => choice.id),
      rewardGearChoices: rewardType === "gear" ? result.rewardState.choices : [],
      selectedRewardId: null,
    });
  }, []);

  return {
    startNextWildwoodBoss,
    resumeWildwoodRun,
    handleDraftPick,
    handleDraftComplete,
    handleWildwoodRecoveryComplete,
    handleWildwoodRewardComplete,
    handleWildwoodRemoveCard,
    handleWildwoodSkipRemoval,
    selectRewardChoice,
    commitWildwoodVictory,
  };
}
