import { useCallback } from "react";
import { readRunSession } from "@/features/alchemy/shared/stores/run-session-read-port";
import {
  setRunDeck,
  setWildwoodDraft,
  setPendingCharacterId,
  releaseRewardClaim,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { teardownRun } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import { dispatchRunSessionCommand, type GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import { createDraftRunRandomSource } from "@/features/alchemy/shared/stores/run-session-write-port";
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
}

export function useWildwoodGauntletFlow({
  navigateTo,
  onStartBossById,
  setHasActiveBattle,
  clearCardHover,
}: UseWildwoodGauntletFlowOptions) {
  const startNextWildwoodBoss = useCallback(
    (onRenderedScreenCommit?: () => void) => {
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
    const routeByPhase = {
      draft: CONSTANTS.SCREENS.DRAFT_DECK,
      reward: CONSTANTS.SCREENS.REWARDS,
      removal: CONSTANTS.SCREENS.WILDWOOD_REMOVAL,
    } as const;
    navigateTo(routeByPhase[state.phase]);
  }, [navigateTo, onStartBossById]);

  const handleDraftPick = useCallback((card: BattleCard) => {
    dispatchRunSessionCommand((draft) => {
      const state = draft.session.wildwoodDraft;
      const activeRun = draft.run.activeRun;
      if (activeRun.contentSystemType !== CONSTANTS.CONTENT_SYSTEMS.WILDWOOD || state?.phase !== "draft") return;
      const nextDeck = [...activeRun.runDeck, card];
      const draftRng = createDraftRunRandomSource(draft, "world");
      setRunDeck(draft, nextDeck);
      setDiscoveredCardIds(draft, (current) => appendUnique(current, card.id));
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
      dispatchRunSessionCommand(
        (draft) => {
          const state = draft.session.wildwoodDraft;
          if (!state) {
            if (!onRenderedScreenCommit) releaseRewardClaim(draft);
            return "empty" as const;
          }
          if (canOfferWildwoodRemoval(draft.run.activeRun.runDeck.length)) {
            setWildwoodDraft(draft, {
              ...state,
              phase: "removal",
              rewardType: null,
              rewardChoiceIds: [],
              rewardGearChoices: [],
              selectedRewardId: null,
            });
            return "removal" as const;
          }
          return "next" as const;
        },
        {
          afterCommit: (result) => {
            if (result === "empty") {
              onRenderedScreenCommit?.();
              return;
            }
            if (result === "removal") {
              navigateTo(CONSTANTS.SCREENS.WILDWOOD_REMOVAL, onRenderedScreenCommit);
              return;
            }
            startNextWildwoodBoss(onRenderedScreenCommit);
          },
        },
      );
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

  const selectRewardChoice = useCallback((id: string) => {
    dispatchRunSessionCommand((draft) => {
      if (draft.run.activeRun.contentSystemType !== CONSTANTS.CONTENT_SYSTEMS.WILDWOOD) return;
      const state = draft.session.wildwoodDraft;
      if (!state) return;
      setWildwoodDraft(draft, { ...state, selectedRewardId: id });
    });
  }, []);

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

  return {
    startNextWildwoodBoss,
    resumeWildwoodRun,
    handleDraftPick,
    handleWildwoodDraftComplete,
    handleWildwoodRewardComplete,
    handleWildwoodRemoveCard,
    handleWildwoodSkipRemoval,
    selectRewardChoice,
    commitWildwoodVictory,
  };
}
