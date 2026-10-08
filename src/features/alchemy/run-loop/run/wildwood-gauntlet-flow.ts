import { runActivityScreen } from "@/lib/active-run-session";
import type { BattleStartCommands } from "@/features/alchemy/shared/stores/battle-start-commands";
import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { teardownRun } from "@/features/alchemy/shared/stores/run-lifecycle";
import { readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { sessionFeedback } from "@/features/alchemy/shared/stores/session-capabilities";
import { canSkipWildwoodRemoval } from "@/lib/content-systems/wildwood/gauntlet";
import { ROUTE_SCREENS, type Screen } from "@/lib/routing";
import { chooseWildwoodDraftCard, completeWildwoodDraft, prepareWildwoodBoss } from "./wildwood-commands";
interface WildwoodGauntletFlowOptions {
  navigateTo: (nextScreen: Screen, prepareNavigation?: () => void) => void;
  resumeTo: (nextScreen: Screen) => void;
  presentBattleStart: BattleStartCommands["presentBattleStart"];
  clearCardHover: () => void;
}
export function createWildwoodGauntletFlow(
  { navigateTo, resumeTo, presentBattleStart, clearCardHover }: WildwoodGauntletFlowOptions,
  gameSession: GameSession,
) {
  const startNextWildwoodBoss = (prepareNavigation?: () => void, removeIndex?: number) => {
    const started = prepareWildwoodBoss(removeIndex, gameSession);
    if (!started) {
      prepareNavigation?.();
      return;
    }
    clearCardHover();
    navigateTo(ROUTE_SCREENS.BATTLE, prepareNavigation);
    presentBattleStart(started.battleStarted);
  };
  const resumeWildwoodRun = () => {
    const session = readRunSession(gameSession);
    const screen = runActivityScreen(session.activity);
    if (!session.wildwoodDraft || !screen) {
      teardownRun(gameSession);
      navigateTo(ROUTE_SCREENS.MENU);
      return;
    }
    resumeTo(screen);
  };
  const handleDraftPick = (arg0: Parameters<typeof chooseWildwoodDraftCard>[0]) =>
    chooseWildwoodDraftCard(arg0, gameSession);
  const handleWildwoodDraftComplete = () => {
    if (completeWildwoodDraft(gameSession)) {
      sessionFeedback(gameSession).playUISound("draftComplete");
      startNextWildwoodBoss();
    }
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
    handleWildwoodRemoveCard,
    handleWildwoodSkipRemoval,
  };
}
