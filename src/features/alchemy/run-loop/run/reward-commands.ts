import {
  appendBoonToRunWithDiscovery,
  appendCardToRunWithDiscovery,
  grantGearToRunWithRecord,
  grantTrinketToRunWithRecord,
} from "@/features/alchemy/shared/stores/deck-mutations";
import { defaultGameSession } from "@/features/alchemy/shared/stores/default-game-session";
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
  beginRewardClaim,
  createDraftRunRandomSource,
  releaseRewardClaim,
  setCompanionRewardCards,
  setRewardState,
  setRunProgressActivity,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { resolveRewardChoice, type ResolvedRewardChoice } from "@/lib/active-run-session";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";
import { REWARD_ROUTES } from "@/lib/routing";
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

export function claimRunReward(choiceId: string | null, gameSession: GameSession = defaultGameSession) {
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
      return acceptCommand({ result, isWildwood });
    },
    undefined,
    gameSession,
  );
}

export function finishRewardClaim(gameSession: GameSession = defaultGameSession): void {
  dispatchRunSessionCommand((draft) => acceptCommand(releaseRewardClaim(draft)), undefined, gameSession);
}
