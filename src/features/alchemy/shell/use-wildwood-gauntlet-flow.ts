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
import {
  dispatchRunSessionCommand,
  isGameplayDraft,
  type GameplayDraft,
} from "@/features/alchemy/shared/stores/run-session-command";
import { bindRunRandomSource } from "@/features/alchemy/shared/stores/run-session-write-port";
import { setDiscoveredCardIds } from "@/features/alchemy/shared/stores/profile-store";
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
        (draft) => {
          const state = draft.session.wildwoodDraft;
          if (!state) return null;
          const draftRng = bindRunRandomSource(rng, draft);
          const draw = drawWildwoodBoss(state.remainingBossIds, state.currentBossId ?? state.previousBossId, draftRng);
          const modifierId = pickWildwoodModifier(draftRng);
          const rewardTraitId = pickWildwoodRewardTrait(draftRng);
          setWildwoodDraft(draft, {
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
          return { bossId: draw.bossId, modifierId };
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
            if (!onStartBossById(started.bossId, undefined, started.modifierId)) {
              logError("[useWildwoodGauntletFlow] startNextWildwoodBoss: failed to start boss battle", "other");
              navigateTo(CONSTANTS.SCREENS.MENU, teardownRun);
              return;
            }
            setHasActiveBattle(true);
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
      dispatchRunSessionCommand((draft) => {
        const state = draft.session.wildwoodDraft;
        const activeRun = draft.run.activeRun;
        if (activeRun.contentSystemType !== CONSTANTS.CONTENT_SYSTEMS.WILDWOOD || state?.phase !== "draft") return;
        const nextDeck = [...activeRun.runDeck, card];
        const draftRng = bindRunRandomSource(rng, draft);
        setRunDeck(draft, nextDeck);
        setDiscoveredCardIds(draft, (current) => appendUnique(current, card.id));
        setWildwoodDraft(draft, {
          ...state,
          draftChoices:
            nextDeck.length >= DRAFT_ROUNDS
              ? []
              : createWildwoodDraftChoices(activeRun.characterId, nextDeck, draftRng),
        });
      });
    },
    [rng],
  );

  const handleDraftComplete = useCallback(
    (draftedCards: BattleCard[]) => {
      if (draftedCards.length < DRAFT_ROUNDS) return;
      dispatchRunSessionCommand((draft) => {
        setRunDeck(draft, draftedCards);
        setPendingCharacterId(draft, null);
      });
      startNextWildwoodBoss();
    },
    [startNextWildwoodBoss],
  );

  const handleWildwoodRecoveryComplete = useCallback(() => {
    dispatchRunSessionCommand(
      (draft) => {
        const wildwood = draft.session.wildwoodDraft;
        if (wildwood?.phase !== "recovery") return false;
        const { runPlayerHealth, runMaxHealth } = draft.run.activeRun;
        setRunPlayerHealth(draft, getWildwoodRecoveryHealth(runPlayerHealth, runMaxHealth));
        setWildwoodDraft(draft, { ...wildwood, phase: "reward" });
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
      dispatchRunSessionCommand((draft) => {
        setRunDeck(draft, (deck) => deck.filter((_, cardIndex) => cardIndex !== index));
      });
      startNextWildwoodBoss();
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

  const commitWildwoodVictory = useCallback(
    (draftOrResult: GameplayDraft | VictoryRewardsResult, result?: VictoryRewardsResult) => {
      const commit = (draft: GameplayDraft, committedResult: VictoryRewardsResult) => {
        const wildwood = draft.session.wildwoodDraft;
        if (!wildwood) return;
        const rewardType = committedResult.rewardState.rewardType;
        setWildwoodDraft(draft, {
          ...wildwood,
          phase: "recovery",
          rewardType,
          rewardChoiceIds: rewardType === "gear" ? [] : committedResult.rewardState.choices.map((choice) => choice.id),
          rewardGearChoices: rewardType === "gear" ? committedResult.rewardState.choices : [],
          selectedRewardId: null,
        });
      };

      if (isGameplayDraft(draftOrResult)) {
        if (result) commit(draftOrResult, result);
        return;
      }
      if (!result) {
        dispatchRunSessionCommand((draft) => commit(draft, draftOrResult));
      }
    },
    [],
  );

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
