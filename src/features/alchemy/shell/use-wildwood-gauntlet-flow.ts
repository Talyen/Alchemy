import { useCallback } from "react";
import { readRunSession, readActiveRun } from "@/features/alchemy/shared/stores/run-session-read-port";
import {
  setRunDeck,
  setRunPlayerHealth,
  setWildwoodDraft,
  setPendingCharacterId,
  releaseRewardClaim,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { teardownRun } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { setDiscoveredCardIds } from "@/features/alchemy/shared/stores/profile-port";
import type { WildwoodRunPort } from "@/features/alchemy/shared/stores/run-port-types";
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
  run: WildwoodRunPort;
  navigateTo: (nextScreen: Screen, onRenderedScreenCommit?: () => void) => void;
  onStartBossById: (
    bossId: string,
    modifiers?: DifficultyModifier[],
    wildwoodModifierId?: WildwoodModifierId,
  ) => boolean;
  setHasActiveBattle: (active: boolean) => void;
  clearCardHover: () => void;
  rng: () => number;
}

export function useWildwoodGauntletFlow({
  run,
  navigateTo,
  onStartBossById,
  setHasActiveBattle,
  clearCardHover,
  rng,
}: UseWildwoodGauntletFlowOptions) {
  const startNextWildwoodBoss = useCallback(
    (onRenderedScreenCommit?: () => void) => {
      dispatchRunSessionCommand(
        () => {
          const state = readRunSession().wildwoodDraft;
          if (!state) return null;
          const draw = drawWildwoodBoss(state.remainingBossIds, state.currentBossId ?? state.previousBossId, rng);
          const modifierId = pickWildwoodModifier(rng);
          const rewardTraitId = pickWildwoodRewardTrait(rng);
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
          if (!onStartBossById(draw.bossId, undefined, modifierId)) return false;
          setHasActiveBattle(true);
          return true;
        },
        {
          afterCommit: (started) => {
            if (started === null) {
              onRenderedScreenCommit?.();
              return;
            }
            if (!started) {
              logError("[useWildwoodGauntletFlow] startNextWildwoodBoss: failed to start boss battle", "other");
              onRenderedScreenCommit?.();
              navigateTo(CONSTANTS.SCREENS.MENU, teardownRun);
              return;
            }
            clearCardHover();
            navigateTo(CONSTANTS.SCREENS.BATTLE, onRenderedScreenCommit);
          },
        },
      );
    },
    [clearCardHover, navigateTo, onStartBossById, rng, setHasActiveBattle],
  );

  const resumeWildwoodRun = useCallback(() => {
    const state = readRunSession().wildwoodDraft;
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
      dispatchRunSessionCommand(() => {
        const state = readRunSession().wildwoodDraft;
        if (run.contentSystemType !== CONSTANTS.CONTENT_SYSTEMS.WILDWOOD || state?.phase !== "draft") return;
        const nextDeck = [...run.runDeck, card];
        setRunDeck(nextDeck);
        setDiscoveredCardIds((current) => appendUnique(current, card.id));
        setWildwoodDraft({
          ...state,
          draftChoices:
            nextDeck.length >= DRAFT_ROUNDS ? [] : createWildwoodDraftChoices(run.characterId, nextDeck, rng),
        });
      });
    },
    [rng, run],
  );

  const handleDraftComplete = useCallback(
    (draftedCards: BattleCard[]) => {
      if (draftedCards.length < DRAFT_ROUNDS) return;
      dispatchRunSessionCommand(() => {
        setRunDeck(draftedCards);
        setPendingCharacterId(null);
        startNextWildwoodBoss();
      });
    },
    [startNextWildwoodBoss],
  );

  const handleWildwoodRecoveryComplete = useCallback(() => {
    dispatchRunSessionCommand(
      () => {
        const wildwood = readRunSession().wildwoodDraft;
        if (wildwood?.phase !== "recovery") return false;
        const { runPlayerHealth, runMaxHealth } = readActiveRun();
        setRunPlayerHealth(getWildwoodRecoveryHealth(runPlayerHealth, runMaxHealth));
        setWildwoodDraft({ ...wildwood, phase: "reward" });
        return true;
      },
      { afterCommit: (advanced) => advanced && navigateTo(CONSTANTS.SCREENS.REWARDS) },
    );
  }, [navigateTo]);

  const handleWildwoodRewardComplete = useCallback(
    (onRenderedScreenCommit?: () => void) => {
      const state = readRunSession().wildwoodDraft;
      if (!state) {
        // settleClaimSurface already releases; fall back when no commit callback was passed.
        if (onRenderedScreenCommit) onRenderedScreenCommit();
        else releaseRewardClaim();
        return;
      }
      if (canOfferWildwoodRemoval(readActiveRun().runDeck.length)) {
        setWildwoodDraft({
          ...state,
          phase: "removal",
          rewardType: null,
          rewardChoiceIds: [],
          rewardGearChoices: [],
          selectedRewardId: null,
        });
        navigateTo(CONSTANTS.SCREENS.WILDWOOD_REMOVAL, onRenderedScreenCommit);
        return;
      }
      startNextWildwoodBoss(onRenderedScreenCommit);
    },
    [navigateTo, startNextWildwoodBoss],
  );

  const handleWildwoodRemoveCard = useCallback(
    (index: number) => {
      dispatchRunSessionCommand(() => {
        setRunDeck((deck) => deck.filter((_, cardIndex) => cardIndex !== index));
        startNextWildwoodBoss();
      });
    },
    [startNextWildwoodBoss],
  );

  const handleWildwoodSkipRemoval = useCallback(() => {
    startNextWildwoodBoss();
  }, [startNextWildwoodBoss]);

  const selectRewardChoice = useCallback(
    (id: string) => {
      const state = readRunSession().wildwoodDraft;
      if (run.contentSystemType === CONSTANTS.CONTENT_SYSTEMS.WILDWOOD && state) {
        setWildwoodDraft({ ...state, selectedRewardId: id });
      }
    },
    [run.contentSystemType],
  );

  const commitWildwoodVictory = useCallback((result: VictoryRewardsResult) => {
    const wildwood = readRunSession().wildwoodDraft;
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
