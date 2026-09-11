import {
  appendBoonToRunWithDiscovery,
  appendCardToRunWithDiscovery,
  grantGearToRunWithRecord,
  grantTrinketToRunWithRecord,
} from "@/features/alchemy/shared/stores/deck-mutations";
import { dispatchRunSessionCommand, type GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import {
  awardMaterialsDuringRun,
  beginRewardClaim,
  createDraftRunRandomSource,
  prepareRunNavigation,
  setCompanionRewardCards,
  setRewardState,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { resolveRewardChoice, type ResolvedRewardChoice } from "@/lib/active-run-session";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";
import { REWARD_ROUTES } from "@/lib/routing";
import { current } from "immer";
import { finalizeRewardState, getRandomPotionCard } from "../navigation/reward-flow";
import { getActiveRewardModifiersForContentSystem, shouldGrantAlchemistReward } from "../navigation/reward-math";
import { awardsRunMaterialsFor } from "./victory-commands";

export function applyRewardSelection({ reward, draft }: { reward: ResolvedRewardChoice; draft: GameplayDraft }) {
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

export function applyAlchemistPotion({ draft, rng }: { draft: GameplayDraft; rng: () => number }) {
  const potion = getRandomPotionCard(rng);
  appendCardToRunWithDiscovery(draft, potion);
}

export function claimRunReward(choiceId: string | null) {
  return dispatchRunSessionCommand((draft) => {
    const session = draft.session;
    if (session.activity.kind !== "rewards") return null;
    if (
      choiceId === null
        ? session.rewardState.rewardType !== "card" && session.rewardState.choices.length > 0
        : !resolveRewardChoice(session.rewardState, choiceId)
    )
      return null;
    if (!beginRewardClaim(draft)) return null;
    const contentSystemType = draft.run.activeRun.contentSystemType;

    const grantAlchemistReward = shouldGrantAlchemistReward(
      getActiveRewardModifiersForContentSystem(
        contentSystemType,
        contentSystemType === CONTENT_SYSTEMS.WILDWOOD
          ? (session.wildwoodDraft?.currentRewardTraitIds ?? [])
          : session.activeLabyrinthRewardModifiers,
      ),
    );
    const result = finalizeRewardState({
      rewardState: { ...current(session.rewardState), selectedId: choiceId },
      companionRewardCards: session.companionRewardCards ? current(session.companionRewardCards) : null,
    });

    const isWildwood = contentSystemType === CONTENT_SYSTEMS.WILDWOOD;
    if (awardsRunMaterialsFor(contentSystemType)) awardMaterialsDuringRun(draft, result.materials);

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
    if (!isWildwood && result.route === REWARD_ROUTES.DESTINATION) prepareRunNavigation(draft, "destination");
    if (!isWildwood && result.route === REWARD_ROUTES.LABYRINTH_MAP) prepareRunNavigation(draft, "labyrinth-map");
    return { result, isWildwood };
  });
}
