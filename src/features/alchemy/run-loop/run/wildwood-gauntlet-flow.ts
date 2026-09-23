import { wildwoodPhaseToScreen } from "@/features/alchemy/shared/run-flow/wildwood-screen-routing";
import { readActiveRun, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { teardownRun } from "@/features/alchemy/shared/stores/run-lifecycle";
import {
  canOfferWildwoodRemoval,
  canSkipWildwoodRemoval,
  type WildwoodModifierId,
} from "@/lib/content-systems/wildwood/gauntlet";
import { logError } from "@/lib/error-logger";
import type { DifficultyModifier } from "@/lib/game-data";
import { ROUTE_SCREENS, type Screen } from "@/lib/routing";
import {
  prepareWildwoodBoss,
  chooseWildwoodDraftCard,
  completeWildwoodDraft,
  prepareWildwoodRemoval,
} from "./wildwood-commands";
import { finishRewardClaim } from "./reward-commands";
interface WildwoodGauntletFlowOptions {
  navigateTo: (nextScreen: Screen, prepareNavigation?: () => void) => void;
  resumeTo: (nextScreen: Screen) => void;
  onStartBossById: (
    bossId: string,
    modifiers?: DifficultyModifier[],
    wildwoodModifierId?: WildwoodModifierId,
  ) => boolean;
  clearCardHover: () => void;
}
export function createWildwoodGauntletFlow({
  navigateTo,
  resumeTo,
  onStartBossById,
  clearCardHover,
}: WildwoodGauntletFlowOptions) {
  const startNextWildwoodBoss = (prepareNavigation?: () => void, removeIndex?: number) => {
    const started = prepareWildwoodBoss(removeIndex);
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
        resumeTo(ROUTE_SCREENS.BATTLE);
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
    const screen = wildwoodPhaseToScreen(state.phase);
    if (screen) resumeTo(screen);
    else navigateTo(ROUTE_SCREENS.MENU);
  };
  const handleDraftPick = chooseWildwoodDraftCard;
  const handleWildwoodDraftComplete = () => {
    if (completeWildwoodDraft()) startNextWildwoodBoss();
  };
  const handleWildwoodRewardComplete = (prepareNavigation?: () => void) => {
    const state = readRunSession().wildwoodDraft;
    if (!state || state.phase !== "reward") {
      if (prepareNavigation) prepareNavigation();
      else finishRewardClaim();
      return;
    }
    if (canOfferWildwoodRemoval(readActiveRun().runDeck.length)) {
      navigateTo(ROUTE_SCREENS.WILDWOOD_REMOVAL, () => {
        prepareWildwoodRemoval();
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
