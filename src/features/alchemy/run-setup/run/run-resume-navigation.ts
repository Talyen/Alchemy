import { readRewardActivity } from "@/lib/active-run-session";
import { resolveDraftAvailableDestinations } from "@/features/alchemy/shared/stores/commands/destination-offer-command";
import { rollFreshBossId } from "@/features/alchemy/shared/config";
import {
  isBossOnlyDestinationOffer,
  restoreOrCreateDestinationRewardState,
} from "@/features/alchemy/shared/run-flow/destination-flow";
import { type GameSession } from "@/features/alchemy/shared/stores/session/game-session-types";
import {
  readActiveRun,
  readHasActiveBattle,
  readHasActiveRun,
  readRunResumeScreen,
} from "@/features/alchemy/shared/stores/session/run-reads";
import {
  acceptCommand,
  dispatchRunSessionCommand,
  snapshotTransactionValue,
  type RunTransaction,
} from "@/features/alchemy/shared/stores/commands/run-session-command";
import {
  createDraftRunRandomSource,
  setDestinationOfferState,
  setPendingCharacterId,
  setPendingContentSystemType,
  setDestinationState,
} from "@/features/alchemy/shared/stores/commands/run-session-write-port";
import { sessionFeedback } from "@/features/alchemy/shared/stores/session/session-capabilities";
import { readProfileStore } from "@/features/alchemy/shared/stores/session/profile-store";
import { isGameModeUnlocked } from "@/lib/game-data";
import { CONTENT_SYSTEMS, type ContentSystemId } from "@/lib/content-systems/types";
import { isEditionModeAvailable } from "@/lib/game-edition";
import { ROUTE_SCREENS } from "@/lib/routing";
import type { ContentSystemNavigationDeps } from "./content-system-navigation-types";

function restoreResumedCampaignDestinations(draft: RunTransaction): void {
  const active = draft.run.activeRun;
  const reward = readRewardActivity(draft.session.activity).state;
  if (reward.destinations.length > 0 && (!isBossOnlyDestinationOffer(reward.destinations) || reward.selectedBossId))
    return;
  setDestinationState(draft, (prev) =>
    restoreOrCreateDestinationRewardState(snapshotTransactionValue(prev), {
      availableDestinations: resolveDraftAvailableDestinations(draft),
      offerState: {
        lastOfferedDestinations: snapshotTransactionValue(active.lastOfferedDestinations),
        roundsSinceOffered: active.destinationRoundsSinceOffered,
      },
      rollBossEnemyId: () => rollFreshBossId(createDraftRunRandomSource(draft, "world")),
      rng: createDraftRunRandomSource(draft, "destinations"),
      onSampled: (result) => setDestinationOfferState(draft, result.offerState),
    }),
  );
}

export function createRunResumeNavigation(deps: ContentSystemNavigationDeps, gameSession: GameSession) {
  function resumeRun() {
    if (!readHasActiveRun(gameSession)) return;
    const mode = readActiveRun(gameSession).contentSystemType;
    dispatchRunSessionCommand(
      (draft) => {
        setPendingContentSystemType(draft, mode);
        setPendingCharacterId(draft, null);

        return acceptCommand();
      },
      undefined,
      gameSession,
    );
    const screen = readRunResumeScreen(gameSession);
    if (!screen) return;
    sessionFeedback(gameSession).playUISound("resumeRun");
    // Card hover clears universally on navigation (see run-flow-engine).
    if (screen === ROUTE_SCREENS.DESTINATION && mode === CONTENT_SYSTEMS.CAMPAIGN) {
      dispatchRunSessionCommand(
        (draft) => acceptCommand(restoreResumedCampaignDestinations(draft)),
        undefined,
        gameSession,
      );
      deps.resumeTo(screen);
    } else if (
      screen === ROUTE_SCREENS.BATTLE &&
      mode === CONTENT_SYSTEMS.WILDWOOD &&
      !readHasActiveBattle(gameSession)
    ) {
      deps.onResumeWildwood();
    } else {
      deps.resumeTo(screen);
    }
  }

  function beginContentSystem(systemId: ContentSystemId) {
    if (!isEditionModeAvailable(systemId)) return;
    if (readHasActiveRun(gameSession)) {
      resumeRun();
      return;
    }
    if (!isGameModeUnlocked(systemId, readProfileStore(gameSession).finishedRunCharacters)) return;
    dispatchRunSessionCommand(
      (draft) => {
        setPendingCharacterId(draft, null);
        setPendingContentSystemType(draft, systemId);

        return acceptCommand();
      },
      undefined,
      gameSession,
    );
    deps.navigateTo(ROUTE_SCREENS.CHARACTER_SELECT);
  }

  return { resumeRun, beginContentSystem };
}
