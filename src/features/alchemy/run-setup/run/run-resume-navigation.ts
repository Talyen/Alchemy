import { rollFreshBossId } from "@/features/alchemy/shared/config";
import { restoreOrCreateDestinationRewardState } from "@/features/alchemy/shared/run-flow/destination-flow";
import { readActiveRun, readHasActiveBattle, readHasActiveRun } from "@/features/alchemy/shared/stores/run-reads";
import { dispatchRunSessionCommand, type GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import { snapshotRun } from "@/features/alchemy/shared/stores/run-lifecycle";
import {
  createDraftRunRandomSource,
  setDestinationOfferState,
  setPendingCharacterId,
  setPendingContentSystemType,
  setRewardState,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { CONTENT_SYSTEMS, type ContentSystemId } from "@/lib/content-systems/types";
import { DESTINATIONS, ROUTE_SCREENS } from "@/lib/routing";
import type { ContentSystemNavigationDeps } from "./content-system-navigation-types";

function restoreResumedCampaignDestinations(
  draft: GameplayDraft,
  getAvailableDestinations: ContentSystemNavigationDeps["getAvailableDestinations"],
): void {
  const active = draft.run.activeRun;
  const reward = draft.session.rewardFlow.state;
  if (
    reward.destinations.length > 0 &&
    (!reward.destinations.includes(DESTINATIONS.BOSS_COMBAT) || reward.selectedBossId)
  )
    return;
  setRewardState(draft, (prev) =>
    restoreOrCreateDestinationRewardState(prev, {
      availableDestinations: getAvailableDestinations({
        currentHealth: active.runPlayerHealth,
        currentGold: draft.runProfile.gold,
        destinationIndexInAct: active.destinationIndexInAct,
        maxHealth: active.runMaxHealth,
      }),
      offerState: {
        lastOfferedDestinations: active.lastOfferedDestinations,
        roundsSinceOffered: active.destinationRoundsSinceOffered,
      },
      bossEnemyId: rollFreshBossId(createDraftRunRandomSource(draft, "world")),
      rng: createDraftRunRandomSource(draft, "destinations"),
      onSampled: (result) => setDestinationOfferState(draft, result.offerState),
    }),
  );
}

export function createRunResumeNavigation(deps: ContentSystemNavigationDeps) {
  function resumeRun() {
    if (!readHasActiveRun()) return;
    const mode = readActiveRun().contentSystemType;
    dispatchRunSessionCommand((draft) => {
      setPendingContentSystemType(draft, mode);
      setPendingCharacterId(draft, null);
    });
    const screen = snapshotRun().currentScreen;
    if (!screen) return;
    deps.clearCardHover();
    if (screen === ROUTE_SCREENS.DESTINATION && mode === CONTENT_SYSTEMS.CAMPAIGN) {
      deps.navigateTo(screen, () => {
        dispatchRunSessionCommand((draft) => {
          restoreResumedCampaignDestinations(draft, deps.getAvailableDestinations);
        });
      });
    } else if (screen === ROUTE_SCREENS.BATTLE && mode === CONTENT_SYSTEMS.WILDWOOD && !readHasActiveBattle()) {
      deps.onResumeWildwood();
    } else {
      deps.navigateTo(screen);
    }
  }

  function beginContentSystem(systemId: ContentSystemId) {
    if (readHasActiveRun()) {
      resumeRun();
      return;
    }
    dispatchRunSessionCommand((draft) => {
      setPendingCharacterId(draft, null);
      setPendingContentSystemType(draft, systemId);
    });
    deps.navigateTo(ROUTE_SCREENS.CHARACTER_SELECT);
  }

  return { resumeRun, beginContentSystem };
}
