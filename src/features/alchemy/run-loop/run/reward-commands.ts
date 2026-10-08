import { canOfferWildwoodRemoval, enterWildwoodRemoval } from "@/lib/content-systems/wildwood/gauntlet";
import { flushSaveAfterRunEnd } from "@/features/alchemy/shared/stores/run-lifecycle";
import {
  clearLabyrinthNodeInDraft,
  completeActInDraft,
  prepareDestinationInDraft,
  prepareNextDestinationInDraft,
} from "./progression-commands";
import { prepareWildwoodBossInDraft } from "./wildwood-commands";
import type { RunFlowHandlerDeps } from "./run-flow";
import {
  appendBoonToRunWithDiscovery,
  appendCardToRunWithDiscovery,
  grantGearToRunWithRecord,
  grantTrinketToRunWithRecord,
} from "@/features/alchemy/shared/stores/deck-mutations";
import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import {
  acceptCommand,
  dispatchRunSessionCommand,
  rejectCommand,
  snapshotTransactionValue,
  type RunTransaction,
} from "@/features/alchemy/shared/stores/run-session-command";
import {
  awardMaterialsDuringRun,
  initializeBattle,
  settleRunVictory,
  setWildwoodDraft,
  beginRewardClaim,
  createDraftRunRandomSource,
  releaseRewardClaim,
  setCompanionRewardCards,
  setRewardState,
  setRunProgressActivity,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { resolveRewardChoice, type ResolvedRewardChoice } from "@/lib/active-run-session";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";
import { REWARD_ROUTES, ROUTE_SCREENS, type Screen } from "@/lib/routing";
import { finalizeRewardState, getRandomPotionCard } from "../navigation/reward-flow";
import { getActiveRewardModifiersForContentSystem, shouldGrantAlchemistReward } from "../navigation/reward-math";

export function applyRewardSelection({ reward, draft }: { reward: ResolvedRewardChoice; draft: RunTransaction }) {
  switch (reward.rewardType) {
    case "card":
      appendCardToRunWithDiscovery(draft, reward.choice);
      return;
    case "boon":
      appendBoonToRunWithDiscovery(draft, reward.choice.id);
      return;
    case "trinket":
      grantTrinketToRunWithRecord(draft, reward.choice.id);
      return;
    case "gear":
      grantGearToRunWithRecord(draft, reward.choice);
      return;
  }
}

export function applyAlchemistPotion({ draft, rng }: { draft: RunTransaction; rng: () => number }) {
  const potion = getRandomPotionCard(rng);
  if (!potion) return;
  appendCardToRunWithDiscovery(draft, potion);
}

export function claimRunReward(
  choiceId: string | null,
  gameSession: GameSession,
  getAvailableDestinations?: RunFlowHandlerDeps["getAvailableDestinations"],
) {
  return dispatchRunSessionCommand(
    (draft) => {
      const session = draft.session;
      if (session.activity.kind !== "rewards") return rejectCommand("Reward cannot be claimed", null);
      // Skipping is only permitted for card rewards (or when no choices are offered).
      // Non-card rewards (gear, trinket, boon) must be claimed with an explicit choice,
      // so a null claim there is rejected and the rewards screen stays put (matching the UI).
      const rewardState = session.rewardFlow.state;
      if (
        choiceId === null
          ? rewardState.rewardType !== "card" && rewardState.choices.length > 0
          : !resolveRewardChoice(snapshotTransactionValue(rewardState), choiceId)
      )
        return rejectCommand("Reward cannot be claimed", null);
      if (!beginRewardClaim(draft)) return rejectCommand("Reward cannot be claimed", null);
      const contentSystemType = draft.run.activeRun.contentSystemType;

      const grantAlchemistReward = shouldGrantAlchemistReward(
        getActiveRewardModifiersForContentSystem(
          contentSystemType,
          snapshotTransactionValue(
            contentSystemType === CONTENT_SYSTEMS.WILDWOOD
              ? (session.wildwoodDraft?.currentRewardTraitIds ?? [])
              : session.activeLabyrinthRewardModifiers,
          ),
        ),
      );
      const result = finalizeRewardState({
        rewardState: { ...snapshotTransactionValue(session.rewardFlow.state), selectedId: choiceId },
        companionRewardCards: session.rewardFlow.companionCards
          ? snapshotTransactionValue(session.rewardFlow.companionCards)
          : null,
      });

      const isWildwood = contentSystemType === CONTENT_SYSTEMS.WILDWOOD;
      awardMaterialsDuringRun(draft, result.materials);

      if (result.selectedReward) {
        applyRewardSelection({
          reward: result.selectedReward,
          draft,
        });
      }
      if (grantAlchemistReward && result.route !== REWARD_ROUTES.COMPANION_REWARD) {
        applyAlchemistPotion({
          draft,
          rng: createDraftRunRandomSource(draft, "rewards"),
        });
      }

      setRewardState(draft, result.nextRewardState);
      if (result.clearCompanionRewardCards) setCompanionRewardCards(draft, null);
      if (!isWildwood && result.route === REWARD_ROUTES.DESTINATION) setRunProgressActivity(draft, "destination");
      if (!isWildwood && result.route === REWARD_ROUTES.LABYRINTH_MAP) setRunProgressActivity(draft, "labyrinth-map");
      let nextScreen: Screen = ROUTE_SCREENS.REWARDS;
      let runEnded = false;
      let battleStarted: ReturnType<typeof initializeBattle> = null;
      if (result.route !== REWARD_ROUTES.COMPANION_REWARD) {
        if (
          !isWildwood &&
          (result.route === REWARD_ROUTES.LABYRINTH_VICTORY || result.route === REWARD_ROUTES.WILDWOOD_VICTORY)
        ) {
          settleRunVictory(draft);
          runEnded = true;
          nextScreen = ROUTE_SCREENS.RUN_VICTORY;
        } else if (isWildwood) {
          if (canOfferWildwoodRemoval(draft.run.activeRun.runDeck.length)) {
            const removal =
              session.wildwoodDraft && enterWildwoodRemoval(snapshotTransactionValue(session.wildwoodDraft));
            if (!removal) return rejectCommand("Wildwood reward cannot advance", null);
            setWildwoodDraft(draft, removal);
            setRunProgressActivity(draft, "wildwood-removal");
            nextScreen = ROUTE_SCREENS.WILDWOOD_REMOVAL;
          } else {
            const prepared = prepareWildwoodBossInDraft(draft);
            if (!prepared) return rejectCommand("Wildwood reward cannot advance", null);
            battleStarted = initializeBattle(draft, {
              kind: "boss-by-id",
              options: { bossId: prepared.bossId, wildwoodModifierId: prepared.modifierId },
            });
            if (!battleStarted) return rejectCommand("Wildwood battle cannot start", null);
            nextScreen = ROUTE_SCREENS.BATTLE;
          }
        } else if (result.route === REWARD_ROUTES.ACT_COMPLETE) {
          if (completeActInDraft(draft)) {
            settleRunVictory(draft);
            runEnded = true;
            nextScreen = ROUTE_SCREENS.RUN_VICTORY;
          } else {
            if (!getAvailableDestinations)
              return rejectCommand("Act advancement requires the bound destination sampler", null);
            prepareNextDestinationInDraft(draft, getAvailableDestinations, 0);
            nextScreen = ROUTE_SCREENS.DESTINATION;
          }
        } else if (result.route === REWARD_ROUTES.LABYRINTH_MAP) {
          clearLabyrinthNodeInDraft(draft);
          nextScreen = ROUTE_SCREENS.LABYRINTH_MAP;
        } else {
          prepareDestinationInDraft(draft);
          nextScreen = ROUTE_SCREENS.DESTINATION;
        }
      }
      return acceptCommand({ result, isWildwood, nextScreen, runEnded, battleStarted });
    },
    {
      afterCommit: (committed) => {
        if (committed?.runEnded) flushSaveAfterRunEnd(gameSession);
      },
    },
    gameSession,
  );
}

export function finishRewardClaim(gameSession: GameSession): void {
  dispatchRunSessionCommand((draft) => acceptCommand(releaseRewardClaim(draft)), undefined, gameSession);
}
