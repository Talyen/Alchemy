import { wildwoodPhaseToScreen } from "@/features/alchemy/shared/run-flow/wildwood-screen-routing";
import type { BattleStartCommands } from "@/features/alchemy/shared/stores/battle-start-commands";
import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { teardownRun } from "@/features/alchemy/shared/stores/run-lifecycle";
import { readActiveRun, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { sessionFeedback } from "@/features/alchemy/shared/stores/session-capabilities";
import { canOfferWildwoodRemoval, canSkipWildwoodRemoval } from "@/lib/content-systems/wildwood/gauntlet";
import { logError } from "@/lib/error-logger";
import { ROUTE_SCREENS, type Screen } from "@/lib/routing";
import { finishRewardClaim } from "./reward-commands";
import {
  chooseWildwoodDraftCard,
  completeWildwoodDraft,
  prepareWildwoodBoss,
  prepareWildwoodRemoval,
} from "./wildwood-commands";
interface WildwoodGauntletFlowOptions {
  navigateTo: (nextScreen: Screen, prepareNavigation?: () => void) => void;
  resumeTo: (nextScreen: Screen) => void;
  startBossById: BattleStartCommands["startBossById"];
  clearCardHover: () => void;
}
export function createWildwoodGauntletFlow(
  { navigateTo, resumeTo, startBossById, clearCardHover }: WildwoodGauntletFlowOptions,
  gameSession: GameSession,
) {
  const startNextWildwoodBoss = (prepareNavigation?: () => void, removeIndex?: number) => {
    const started = prepareWildwoodBoss(removeIndex, gameSession);
    if (!started) {
      prepareNavigation?.();
      return;
    }
    if (!startBossById({ bossId: started.bossId, wildwoodModifierId: started.modifierId })) {
      logError("[Wildwood] Failed to start boss battle", "other");
      prepareNavigation?.();
      navigateTo(ROUTE_SCREENS.MENU, () => teardownRun(gameSession));
      return;
    }
    clearCardHover();
    navigateTo(ROUTE_SCREENS.BATTLE, prepareNavigation);
  };
  const resumeWildwoodRun = () => {
    const state = readRunSession(gameSession).wildwoodDraft;
    if (!state) {
      navigateTo(ROUTE_SCREENS.MENU, () => teardownRun(gameSession));
      return;
    }
    if (state.phase === "battle" && state.currentBossId && state.currentCombatTraitIds[0]) {
      if (startBossById({ bossId: state.currentBossId, wildwoodModifierId: state.currentCombatTraitIds[0] })) {
        resumeTo(ROUTE_SCREENS.BATTLE);
      } else {
        logError("[createWildwoodGauntletFlow] resumeWildwoodRun: failed to resume boss battle", "other");
        navigateTo(ROUTE_SCREENS.MENU, () => teardownRun(gameSession));
      }
      return;
    }
    if (state.phase === "battle") {
      navigateTo(ROUTE_SCREENS.MENU, () => teardownRun(gameSession));
      return;
    }
    const screen = wildwoodPhaseToScreen(state.phase);
    if (screen) resumeTo(screen);
    else navigateTo(ROUTE_SCREENS.MENU);
  };
  const handleDraftPick = (arg0: Parameters<typeof chooseWildwoodDraftCard>[0]) =>
    chooseWildwoodDraftCard(arg0, gameSession);
  const handleWildwoodDraftComplete = () => {
    if (completeWildwoodDraft(gameSession)) {
      sessionFeedback(gameSession).playUISound("draftComplete");
      startNextWildwoodBoss();
    }
  };
  const handleWildwoodRewardComplete = (prepareNavigation?: () => void) => {
    const state = readRunSession(gameSession).wildwoodDraft;
    if (!state || state.phase !== "reward") {
      if (prepareNavigation) prepareNavigation();
      else finishRewardClaim(gameSession);
      return;
    }
    if (canOfferWildwoodRemoval(readActiveRun(gameSession).runDeck.length)) {
      navigateTo(ROUTE_SCREENS.WILDWOOD_REMOVAL, () => {
        prepareWildwoodRemoval(gameSession);
        prepareNavigation?.();
      });
      return;
    }
    startNextWildwoodBoss(prepareNavigation);
  };
  const handleWildwoodRemoveCard = (index: number) => startNextWildwoodBoss(undefined, index);
  const handleWildwoodSkipRemoval = () => {
    const state = readRunSession(gameSession).wildwoodDraft;
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
