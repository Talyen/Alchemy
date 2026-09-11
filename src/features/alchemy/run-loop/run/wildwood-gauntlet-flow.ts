import { wildwoodPhaseToScreen } from "@/features/alchemy/shared/run-flow/wildwood-screen-routing";
import { appendCardToRunWithDiscovery } from "@/features/alchemy/shared/stores/deck-mutations";
import { readActiveRun, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { teardownRun } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import {
  createDraftRunRandomSource,
  prepareRunNavigation,
  releaseRewardClaim,
  setPendingCharacterId,
  setRunDeck,
  setWildwoodDraft,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";
import {
  canCompleteWildwoodDraft,
  canOfferWildwoodRemoval,
  canPrepareNextWildwoodBoss,
  canSkipWildwoodRemoval,
  enterWildwoodBattle,
  enterWildwoodRemoval,
  offeredWildwoodDraftCard,
  pickWildwoodDraftCard,
  prepareNextWildwoodBoss,
  removeWildwoodCard,
  type WildwoodModifierId,
} from "@/lib/content-systems/wildwood/gauntlet";
import { logError } from "@/lib/error-logger";
import { type DifficultyModifier } from "@/lib/game-data";
import { ROUTE_SCREENS, type Screen } from "@/lib/routing";
interface WildwoodGauntletFlowOptions {
  navigateTo: (nextScreen: Screen, prepareNavigation?: () => void) => void;
  onStartBossById: (
    bossId: string,
    modifiers?: DifficultyModifier[],
    wildwoodModifierId?: WildwoodModifierId,
  ) => boolean;
  setHasActiveBattle: (active: boolean) => void;
  clearCardHover: () => void;
}
export function createWildwoodGauntletFlow({
  navigateTo,
  onStartBossById,
  setHasActiveBattle,
  clearCardHover,
}: WildwoodGauntletFlowOptions) {
  const startNextWildwoodBoss = (prepareNavigation?: () => void, removeIndex?: number) => {
    const started = dispatchRunSessionCommand((draft) => {
      const state = draft.session.wildwoodDraft;
      const deck = draft.run.activeRun.runDeck;
      if (!state || !canPrepareNextWildwoodBoss(state, deck.length)) return null;
      const nextDeck = removeIndex === undefined ? deck : removeWildwoodCard(state, deck, removeIndex);
      if (!nextDeck) return null;
      const prepared = prepareNextWildwoodBoss(state, deck.length, createDraftRunRandomSource(draft, "world"));
      if (!prepared) return null;
      const battle = enterWildwoodBattle(prepared.state);
      if (!battle) return null;
      if (removeIndex !== undefined) setRunDeck(draft, nextDeck);
      setWildwoodDraft(draft, battle);
      prepareRunNavigation(draft, ROUTE_SCREENS.BATTLE);
      return { bossId: prepared.bossId, modifierId: prepared.modifierId };
    });
    if (!started) {
      prepareNavigation?.();
      return;
    }
    if (!onStartBossById(started.bossId, undefined, started.modifierId)) {
      logError("[Wildwood] Failed to start boss battle", "other");
      prepareNavigation?.();
      navigateTo(ROUTE_SCREENS.MENU, teardownRun);
      return;
    }
    setHasActiveBattle(true);
    clearCardHover();
    navigateTo(ROUTE_SCREENS.BATTLE, prepareNavigation);
  };
  const resumeWildwoodRun = () => {
    const state = readRunSession().wildwoodDraft;
    if (!state) {
      navigateTo(ROUTE_SCREENS.MENU, teardownRun);
      return;
    }
    if (state.phase === "battle" && state.currentBossId && state.currentCombatTraitIds[0]) {
      if (onStartBossById(state.currentBossId, undefined, state.currentCombatTraitIds[0])) {
        navigateTo(ROUTE_SCREENS.BATTLE);
      } else {
        logError("[createWildwoodGauntletFlow] resumeWildwoodRun: failed to resume boss battle", "other");
        navigateTo(ROUTE_SCREENS.MENU, teardownRun);
      }
      return;
    }
    if (state.phase === "battle") {
      navigateTo(ROUTE_SCREENS.MENU, teardownRun);
      return;
    }
    navigateTo(wildwoodPhaseToScreen(state.phase) ?? ROUTE_SCREENS.MENU);
  };
  const handleDraftPick = (cardId: string) => {
    dispatchRunSessionCommand((draft) => {
      const state = draft.session.wildwoodDraft;
      const activeRun = draft.run.activeRun;
      if (activeRun.contentSystemType !== CONTENT_SYSTEMS.WILDWOOD || !state) return;
      if (!offeredWildwoodDraftCard(state, activeRun.runDeck, cardId)) return;
      const pick = pickWildwoodDraftCard(
        state,
        activeRun.characterId,
        activeRun.runDeck,
        cardId,
        createDraftRunRandomSource(draft, "world"),
      );
      if (!pick) return;
      appendCardToRunWithDiscovery(draft, pick.card);
      setWildwoodDraft(draft, pick.state);
    });
  };
  const handleWildwoodDraftComplete = () => {
    dispatchRunSessionCommand(
      (draft) => {
        const state = draft.session.wildwoodDraft;
        const runDeck = draft.run.activeRun.runDeck;
        if (!state || !canCompleteWildwoodDraft(state, runDeck.length)) return false;
        setPendingCharacterId(draft, null);
        return true;
      },
      { afterCommit: (completed) => completed && startNextWildwoodBoss() },
    );
  };
  const handleWildwoodRewardComplete = (prepareNavigation?: () => void) => {
    const state = readRunSession().wildwoodDraft;
    if (!state || state.phase !== "reward") {
      if (prepareNavigation) prepareNavigation();
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
        prepareNavigation?.();
      });
      return;
    }
    startNextWildwoodBoss(prepareNavigation);
  };
  const handleWildwoodRemoveCard = (index: number) => startNextWildwoodBoss(undefined, index);
  const handleWildwoodSkipRemoval = () => {
    const state = readRunSession().wildwoodDraft;
    if (!state || !canSkipWildwoodRemoval(state)) return;
    startNextWildwoodBoss();
  };
  return {
    startNextWildwoodBoss,
    resumeWildwoodRun,
    handleDraftPick,
    handleWildwoodDraftComplete,
    handleWildwoodRewardComplete,
    handleWildwoodRemoveCard,
    handleWildwoodSkipRemoval,
  };
}
