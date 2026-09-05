import { useMemo } from "react";
import { useUiStore } from "../../shared/stores/ui-store";
import { getCardKeywords } from "@/lib/game-data";
import { getGearInstanceTitle } from "@/lib/gear";
import { cn } from "@/lib/utils";
import { MATERIAL_IDS, type MaterialId } from "@/lib/homestead/types";

import { GearTile, TrinketTile } from "../../shared/ui/collection-art-tiles";
import { FoundResourcesRow } from "../../shared/ui/found-resources-row";
import { SelectableCard } from "../../shared/ui/selectable-card";
import { ActionButtonRow, TitledScreenShell } from "../../shared/ui/shared-ui";
import { usePlasmaBaseline, usePlasmaInteraction } from "../../shared/ui/use-plasma-source";
import { FadeSlot } from "../../shared/ui/use-fade";
import { getPlasmaKeywordsForGear, getPlasmaColorPair, sectionTitleClass } from "@/features/alchemy/shared/config";
import { getTrinketKeywords } from "@/features/alchemy/shared/config/game-data-catalog";
import {
  getRewardChoiceId,
  resolveRewardChoice,
  type ResolvedRewardChoice,
  type RewardState,
} from "@/lib/active-run-session";

function RewardChoiceItems({
  rewardState,
  selectedRewardId,
  onSelectReward,
}: {
  rewardState: RewardState;
  selectedRewardId: string | null;
  onSelectReward: (id: string) => void;
}) {
  switch (rewardState.rewardType) {
    case "gear":
      return rewardState.choices.map((instance) => {
        const choiceId = getRewardChoiceId(instance);
        return (
          <div key={choiceId}>
            <GearTile
              instance={instance}
              interactionKey="reward"
              as="button"
              selected={selectedRewardId === choiceId}
              onClick={() => onSelectReward(choiceId)}
              ariaLabel={`Select ${getGearInstanceTitle(instance)}`}
            />
          </div>
        );
      });
    case "boon":
    case "trinket":
      return rewardState.choices.map((trinket) => {
        const choiceId = getRewardChoiceId(trinket);
        return (
          <div key={choiceId}>
            <TrinketTile
              trinket={trinket}
              interactionKey="reward"
              as="button"
              selected={selectedRewardId === choiceId}
              temporary={rewardState.rewardType === "boon"}
              onClick={() => onSelectReward(choiceId)}
              ariaLabel={`Select ${trinket.title}`}
            />
          </div>
        );
      });
    case "card":
      return rewardState.choices.map((card) => {
        const choiceId = getRewardChoiceId(card);
        return (
          <div key={choiceId}>
            <SelectableCard
              card={card}
              isSelected={selectedRewardId === choiceId}
              onSelect={() => onSelectReward(choiceId)}
              interactionKey="reward"
            />
          </div>
        );
      });
  }
}

function getRewardColorPair(reward: ResolvedRewardChoice | null) {
  if (!reward) return null;
  switch (reward.rewardType) {
    case "gear":
      return getPlasmaColorPair(getPlasmaKeywordsForGear(reward.choice));
    case "boon":
    case "trinket":
      return getPlasmaColorPair(getTrinketKeywords(reward.choice.id));
    case "card":
      return getPlasmaColorPair(getCardKeywords(reward.choice));
  }
}

function RewardsFound({
  rewardGold,
  rewardMaterials,
}: {
  rewardGold: number;
  rewardMaterials: Partial<Record<MaterialId, number>>;
}) {
  const hasRewards = rewardGold > 0 || MATERIAL_IDS.some((mat) => (rewardMaterials[mat] ?? 0) > 0);
  if (!hasRewards) {
    return <div className="min-h-[calc(2.5*var(--content-rem,1rem))]" />;
  }
  return <FoundResourcesRow gold={rewardGold} materials={rewardMaterials} />;
}

function getRewardPrompt(rewardType: RewardState["rewardType"]): string {
  switch (rewardType) {
    case "gear":
      return "Add Gear to your Armory";
    case "trinket":
      return "Choose a Trinket to add to your Armory";
    case "boon":
      return "Choose a Boon for this Run";
    case "card":
      return "Add a Card to your Deck";
  }
}

function getRewardPrimaryLabel(rewardType: RewardState["rewardType"]): string {
  switch (rewardType) {
    case "gear":
      return "Take Gear";
    case "trinket":
      return "Take Trinket";
    case "boon":
      return "Take Boon";
    case "card":
      return "Add Card";
  }
}

export function RewardsScreen({
  rewardState,
  onAddReward,
  onSkip,
  onSelectReward,
  claimInFlight = false,
}: {
  rewardState: RewardState;
  onAddReward: () => void;
  onSkip: () => void;
  onSelectReward: (id: string) => void;
  claimInFlight?: boolean;
}) {
  const rewardChoices = rewardState.choices;
  const rewardGold = rewardState.gold;
  const rewardMaterials = rewardState.materials;
  const selectedRewardId = rewardState.selectedId;
  const choicePrompt = getRewardPrompt(rewardState.rewardType);

  const hoveredCardId = useUiStore((s) => s.hoveredCardId);
  const { hoveredReward, selectedReward } = useMemo(() => {
    const hoveredId = hoveredCardId?.startsWith("reward-") ? hoveredCardId.slice("reward-".length) : null;
    return {
      hoveredReward: resolveRewardChoice(rewardState, hoveredId),
      selectedReward: resolveRewardChoice(rewardState),
    };
  }, [hoveredCardId, rewardState]);

  const claimLocked = claimInFlight || rewardChoices.length === 0;
  usePlasmaBaseline(getRewardColorPair(selectedReward));
  usePlasmaInteraction(getRewardColorPair(hoveredReward), hoveredReward !== null);

  return (
    <TitledScreenShell title="Victory" maxWidthClass="max-w-6xl">
      <h2 className={cn("mt-3 text-center font-sans", sectionTitleClass)}>{choicePrompt}</h2>

      <FadeSlot
        swapKey={rewardChoices.map((item) => getRewardChoiceId(item)).join("-")}
        className="mt-8 flex flex-col items-center gap-8"
      >
        <div className="flex flex-wrap items-start justify-center gap-6">
          <RewardChoiceItems
            rewardState={rewardState}
            selectedRewardId={selectedRewardId}
            onSelectReward={onSelectReward}
          />
        </div>

        <RewardsFound rewardGold={rewardGold} rewardMaterials={rewardMaterials} />
      </FadeSlot>

      <ActionButtonRow
        className="mt-5"
        width="action"
        {...(rewardState.rewardType === "card"
          ? {
              secondary: {
                label: "Skip",
                onClick: onSkip,

                disabled: claimLocked,
              },
            }
          : {})}
        primary={{
          label: getRewardPrimaryLabel(rewardState.rewardType),
          disabled: !selectedReward || claimLocked,
          onClick: onAddReward,
        }}
      />
    </TitledScreenShell>
  );
}
