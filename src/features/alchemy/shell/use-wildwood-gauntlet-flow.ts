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
import { logError } from "@/lib/error-logger";
import { wildwoodPhaseToScreen } from "@/features/alchemy/shared/run-flow/wildwood-screen-routing";
import {
  canOfferWildwoodRemoval,
  canCompleteWildwoodDraft,
  canPrepareNextWildwoodBoss,
  canSkipWildwoodRemoval,
  enterWildwoodBattle,
  enterWildwoodRemoval,
  enterWildwoodReward,
  offeredWildwoodDraftCard,
  pickWildwoodDraftCard,
  prepareNextWildwoodBoss,
  removeWildwoodCard,
  type WildwoodModifierId,
} from "@/lib/content-systems/wildwood/gauntlet";
import type { VictoryRewardsResult } from "@/features/alchemy/run-loop/navigation/victory-flow";
import { ROUTE_SCREENS, type Screen } from "@/lib/routing";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";
import { type BattleCard, type DifficultyModifier } from "@/lib/game-data";

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

interface OutgoingScreenCommit {
  canCommit: (draft: GameplayDraft) => boolean;
  commit: (draft: GameplayDraft) => void;
}

function sameCardIds(left: readonly BattleCard[], right: readonly BattleCard[]): boolean {
  return left.length === right.length && left.every((card, index) => card.id === right[index]?.id);
}

export function useWildwoodGauntletFlow({
  navigateTo,
  onStartBossById,
  setHasActiveBattle,
  clearCardHover,
}: UseWildwoodGauntletFlowOptions) {
  const bossTransitionPendingRef = useRef(false);
  const startNextWildwoodBoss = useCallback(
    (onRenderedScreenCommit?: () => void, outgoing?: OutgoingScreenCommit) => {
      if (bossTransitionPendingRef.current) return;
      bossTransitionPendingRef.current = true;
      dispatchRunSessionCommand(
        (draft) => {
          if (outgoing && !outgoing.canCommit(draft)) return null;
          const state = draft.session.wildwoodDraft;
          if (!state || !canPrepareNextWildwoodBoss(state, draft.run.activeRun.runDeck.length)) return null;
          const prepared = prepareNextWildwoodBoss(
            state,
            draft.run.activeRun.runDeck.length,
            createDraftRunRandomSource(draft, "world"),
          );
          if (!prepared) return null;
          setWildwoodDraft(draft, prepared.state);
          return { bossId: prepared.bossId, modifierId: prepared.modifierId };
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
              navigateTo(ROUTE_SCREENS.MENU, teardownRun);
              return;
            }
            navigateTo(ROUTE_SCREENS.BATTLE, () => {
              dispatchRunSessionCommand((draft) => {
                outgoing?.commit(draft);
                const state = draft.session.wildwoodDraft;
                if (!state) return;
                const battleState = enterWildwoodBattle(state);
                if (battleState) setWildwoodDraft(draft, battleState);
              });
              if (!onStartBossById(started.bossId, undefined, started.modifierId)) {
                bossTransitionPendingRef.current = false;
                logError("[useWildwoodGauntletFlow] startNextWildwoodBoss: failed to start boss battle", "other");
                onRenderedScreenCommit?.();
                navigateTo(ROUTE_SCREENS.MENU, teardownRun);
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
      navigateTo(ROUTE_SCREENS.MENU, teardownRun);
      return;
    }
    if (state.phase === "battle" && state.currentBossId && state.currentCombatTraitIds[0]) {
      if (onStartBossById(state.currentBossId, undefined, state.currentCombatTraitIds[0])) {
        navigateTo(ROUTE_SCREENS.BATTLE);
      } else {
        logError("[useWildwoodGauntletFlow] resumeWildwoodRun: failed to resume boss battle", "other");
        navigateTo(ROUTE_SCREENS.MENU, teardownRun);
      }
      return;
    }
    if (state.phase === "battle") {
      navigateTo(ROUTE_SCREENS.MENU, teardownRun);
      return;
    }
    navigateTo(wildwoodPhaseToScreen(state.phase) ?? ROUTE_SCREENS.MENU);
  }, [navigateTo, onStartBossById]);

  const handleDraftPick = useCallback((card: BattleCard) => {
    dispatchRunSessionCommand((draft) => {
      const state = draft.session.wildwoodDraft;
      const activeRun = draft.run.activeRun;
      if (activeRun.contentSystemType !== CONTENT_SYSTEMS.WILDWOOD || !state) return;
      if (!offeredWildwoodDraftCard(state, activeRun.runDeck, card.id)) return;
      const pick = pickWildwoodDraftCard(
        state,
        activeRun.characterId,
        activeRun.runDeck,
        card.id,
        createDraftRunRandomSource(draft, "world"),
      );
      if (!pick) return;
      appendCardToRunWithDiscovery(draft, pick.card);
      setWildwoodDraft(draft, pick.state);
    });
  }, []);

  const handleWildwoodDraftComplete = useCallback(
    (draftedCards: BattleCard[]) => {
      dispatchRunSessionCommand(
        (draft) => {
          const state = draft.session.wildwoodDraft;
          const runDeck = draft.run.activeRun.runDeck;
          if (!state || !canCompleteWildwoodDraft(state, runDeck.length)) return false;
          if (!sameCardIds(runDeck, draftedCards)) return false;
          setPendingCharacterId(draft, null);
          return true;
        },
        { afterCommit: (completed) => completed && startNextWildwoodBoss() },
      );
    },
    [startNextWildwoodBoss],
  );

  const handleWildwoodRewardComplete = useCallback(
    (onRenderedScreenCommit?: () => void) => {
      const state = readRunSession().wildwoodDraft;
      if (!state || state.phase !== "reward") {
        if (onRenderedScreenCommit) onRenderedScreenCommit();
        else dispatchRunSessionCommand((draft) => releaseRewardClaim(draft));
        return;
      }
      if (canOfferWildwoodRemoval(readActiveRun().runDeck.length)) {
        navigateTo(ROUTE_SCREENS.WILDWOOD_REMOVAL, () => {
          dispatchRunSessionCommand((draft) => {
            const current = draft.session.wildwoodDraft;
            if (!current) return;
            const removalState = enterWildwoodRemoval(current);
            if (removalState) setWildwoodDraft(draft, removalState);
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
      startNextWildwoodBoss(undefined, {
        canCommit: (draft) => {
          const current = draft.session.wildwoodDraft;
          return current != null && removeWildwoodCard(current, draft.run.activeRun.runDeck, index) != null;
        },
        commit: (draft) => {
          const current = draft.session.wildwoodDraft;
          if (!current) return;
          const nextDeck = removeWildwoodCard(current, draft.run.activeRun.runDeck, index);
          if (nextDeck) setRunDeck(draft, nextDeck);
        },
      });
    },
    [startNextWildwoodBoss],
  );

  const handleWildwoodSkipRemoval = useCallback(() => {
    const state = readRunSession().wildwoodDraft;
    if (!state || !canSkipWildwoodRemoval(state)) return;
    startNextWildwoodBoss();
  }, [startNextWildwoodBoss]);

  const commitWildwoodVictory = useCallback((draft: GameplayDraft, _result: VictoryRewardsResult) => {
    const wildwood = draft.session.wildwoodDraft;
    if (!wildwood) return;
    const rewardState = enterWildwoodReward(wildwood);
    if (rewardState) setWildwoodDraft(draft, rewardState);
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
