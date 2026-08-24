import { useCallback, useMemo, useRef } from "react";
import { readActiveRun, readRunSession } from "@/features/alchemy/shared/stores/run-session-read-port";
import {
  setRunDeck,
  setWildwoodDraft,
  setPendingCharacterId,
  releaseRewardClaim,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { teardownRun } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import { dispatchRunSessionCommand, type GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import { createDraftRunRandomSource } from "@/features/alchemy/shared/stores/run-session-write-port";
import { appendCardToRunWithDiscovery } from "@/features/alchemy/run-loop/run/deck-mutations";
import { type BattleCard, type DifficultyModifier } from "@/lib/game-data";
import { logError } from "@/lib/error-logger";
import { CONSTANTS } from "@/features/alchemy/shared/types";
import type { Screen } from "@/lib/routing";
import { DRAFT_ROUNDS } from "@/lib/game-constants";
import { wildwoodPhaseToScreen } from "@/features/alchemy/shared/run-flow/wildwood-screen-routing";
import {
  createWildwoodDraftChoices,
  canOfferWildwoodRemoval,
  drawWildwoodBoss,
  pickWildwoodModifier,
  pickWildwoodRewardTrait,
  type WildwoodModifierId,
} from "@/lib/content-systems/wildwood/gauntlet";
import type { VictoryRewardsResult } from "@/features/alchemy/run-loop/navigation/victory-flow";

interface UseWildwoodGauntletFlowOptions {
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
  navigateTo,
  onStartBossById,
  setHasActiveBattle,
  clearCardHover,
}: UseWildwoodGauntletFlowOptions) {
  const bossTransitionPendingRef = useRef(false);
  const startNextWildwoodBoss = useCallback(
    (onRenderedScreenCommit?: () => void, commitOutgoingScreen?: (draft: GameplayDraft) => void) => {
      if (bossTransitionPendingRef.current) return;
      bossTransitionPendingRef.current = true;
      dispatchRunSessionCommand(
        (draft) => {
          const state = draft.session.wildwoodDraft;
          if (!state) return null;
          const draftRng = createDraftRunRandomSource(draft, "world");
          const draw = drawWildwoodBoss(state.remainingBossIds, state.currentBossId ?? state.previousBossId, draftRng);
          const modifierId = pickWildwoodModifier(draftRng);
          const rewardTraitId = pickWildwoodRewardTrait(draftRng);
          setWildwoodDraft(draft, {
            ...state,
            remainingBossIds: draw.remainingBossIds,
            previousBossId: state.currentBossId ?? state.previousBossId,
            currentBossId: draw.bossId,
            currentCombatTraitIds: [modifierId],
            currentRewardTraitIds: [rewardTraitId],
          });
          return { bossId: draw.bossId, modifierId };
        },
        {
          afterCommit: (started) => {
            if (started === null) {
              bossTransitionPendingRef.current = false;
              onRenderedScreenCommit?.();
              return;
            }
            if (!started) {
              bossTransitionPendingRef.current = false;
              logError("[useWildwoodGauntletFlow] startNextWildwoodBoss: failed to start boss battle", "other");
              onRenderedScreenCommit?.();
              navigateTo(CONSTANTS.SCREENS.MENU, teardownRun);
              return;
            }
            navigateTo(CONSTANTS.SCREENS.BATTLE, () => {
              dispatchRunSessionCommand((draft) => {
                commitOutgoingScreen?.(draft);
                const state = draft.session.wildwoodDraft;
                if (!state) return;
                setWildwoodDraft(draft, {
                  ...state,
                  phase: "battle",
                  rewardType: null,
                  rewardChoiceIds: [],
                  rewardGearChoices: [],
                  selectedRewardId: null,
                });
              });
              if (!onStartBossById(started.bossId, undefined, started.modifierId)) {
                bossTransitionPendingRef.current = false;
                logError("[useWildwoodGauntletFlow] startNextWildwoodBoss: failed to start boss battle", "other");
                onRenderedScreenCommit?.();
                navigateTo(CONSTANTS.SCREENS.MENU, teardownRun);
                return;
              }
              setHasActiveBattle(true);
              clearCardHover();
              bossTransitionPendingRef.current = false;
              onRenderedScreenCommit?.();
            });
          },
        },
      );
    },
    [clearCardHover, navigateTo, onStartBossById, setHasActiveBattle],
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
    navigateTo(wildwoodPhaseToScreen(state.phase) ?? CONSTANTS.SCREENS.MENU);
  }, [navigateTo, onStartBossById]);

  const handleDraftPick = useCallback((card: BattleCard) => {
    dispatchRunSessionCommand((draft) => {
      const state = draft.session.wildwoodDraft;
      const activeRun = draft.run.activeRun;
      if (activeRun.contentSystemType !== CONSTANTS.CONTENT_SYSTEMS.WILDWOOD || state?.phase !== "draft") return;
      const nextDeck = [...activeRun.runDeck, card];
      const draftRng = createDraftRunRandomSource(draft, "world");
      appendCardToRunWithDiscovery(draft, card);
      setWildwoodDraft(draft, {
        ...state,
        draftChoices:
          nextDeck.length >= DRAFT_ROUNDS ? [] : createWildwoodDraftChoices(activeRun.characterId, nextDeck, draftRng),
      });
    });
  }, []);

  const handleWildwoodDraftComplete = useCallback(
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

  const handleWildwoodRewardComplete = useCallback(
    (onRenderedScreenCommit?: () => void) => {
      const state = readRunSession().wildwoodDraft;
      if (!state) {
        if (onRenderedScreenCommit) onRenderedScreenCommit();
        else dispatchRunSessionCommand((draft) => releaseRewardClaim(draft));
        return;
      }
      if (canOfferWildwoodRemoval(readActiveRun().runDeck.length)) {
        navigateTo(CONSTANTS.SCREENS.WILDWOOD_REMOVAL, () => {
          dispatchRunSessionCommand((draft) => {
            const current = draft.session.wildwoodDraft;
            if (!current) return;
            setWildwoodDraft(draft, {
              ...current,
              phase: "removal",
              rewardType: null,
              rewardChoiceIds: [],
              rewardGearChoices: [],
              selectedRewardId: null,
            });
          });
          onRenderedScreenCommit?.();
        });
        return;
      }
      startNextWildwoodBoss(onRenderedScreenCommit);
    },
    [navigateTo, startNextWildwoodBoss],
  );

  const handleWildwoodRemoveCard = useCallback(
    (index: number) => {
      startNextWildwoodBoss(undefined, (draft) => {
        setRunDeck(draft, (deck) => deck.filter((_, cardIndex) => cardIndex !== index));
      });
    },
    [startNextWildwoodBoss],
  );

  const handleWildwoodSkipRemoval = useCallback(() => {
    startNextWildwoodBoss();
  }, [startNextWildwoodBoss]);

  const commitWildwoodVictory = useCallback((draft: GameplayDraft, result: VictoryRewardsResult) => {
    const wildwood = draft.session.wildwoodDraft;
    if (!wildwood) return;
    const rewardType = result.rewardState.rewardType;
    setWildwoodDraft(draft, {
      ...wildwood,
      phase: "reward",
      rewardType,
      rewardChoiceIds: rewardType === "gear" ? [] : result.rewardState.choices.map((choice) => choice.id),
      rewardGearChoices: rewardType === "gear" ? result.rewardState.choices : [],
      selectedRewardId: null,
    });
  }, []);

  return useMemo(
    () => ({
      startNextWildwoodBoss,
      resumeWildwoodRun,
      handleDraftPick,
      handleWildwoodDraftComplete,
      handleWildwoodRewardComplete,
      handleWildwoodRemoveCard,
      handleWildwoodSkipRemoval,
      commitWildwoodVictory,
    }),
    [
      startNextWildwoodBoss,
      resumeWildwoodRun,
      handleDraftPick,
      handleWildwoodDraftComplete,
      handleWildwoodRewardComplete,
      handleWildwoodRemoveCard,
      handleWildwoodSkipRemoval,
      commitWildwoodVictory,
    ],
  );
}
