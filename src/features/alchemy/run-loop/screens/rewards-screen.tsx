import { useMemo } from "react";
import { useUiStore } from "../../shared/stores/ui-store";
import { getCardKeywords } from "@/lib/game-data";
import { getGearInstanceTitle } from "@/lib/gear";
import { cn } from "@/lib/utils";
import { MATERIAL_IDS, type MaterialId } from "@/lib/homestead/types";

import { GearTile, TrinketTile } from "../../shared/ui/collection-art-tiles";
import { FoundResourcesRow } from "../../shared/ui/found-resources-row";
import { SelectableCard } from "../../shared/ui/selectable-card";
import { Button } from "@/components/ui/button";
import { TitledScreenShell } from "../../shared/ui/layout-components";
import { usePlasmaInteraction } from "../../shared/ui/use-plasma-source";
import { FadeSlot } from "../../shared/ui/use-fade";
import {
  getPlasmaKeywordsForGear,
  getPlasmaColorPair,
  getInspectionKeywordShineColors,
  BUTTON_WIDTH_ACTION,
  sectionTitleClass,
} from "@/features/alchemy/shared/config";
import { getTrinketKeywords } from "@/features/alchemy/shared/config/game-data-catalog";
import {
  getRewardChoiceId,
  resolveRewardChoice,
  type ResolvedRewardChoice,
  type RewardState,
} from "@/lib/active-run-session";

function RewardChoiceItems({
  rewardState,
  disabled,
  onClaimReward,
}: {
  rewardState: RewardState;
  disabled: boolean;
  onClaimReward: (id: string) => void;
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
              disabled={disabled}
              hoverKeywordShine
              onClick={() => onClaimReward(choiceId)}
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
              disabled={disabled}
              hoverKeywordShine
              temporary={rewardState.rewardType === "boon"}
              onClick={() => onClaimReward(choiceId)}
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
              isSelected={false}
              disabled={disabled}
              shineColor={getInspectionKeywordShineColors(getCardKeywords(card))}
              onSelect={() => onClaimReward(choiceId)}
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

export function RewardsScreen({
  rewardState,
  onSkip,
  onClaimReward,
  claimInFlight = false,
}: {
  rewardState: RewardState;
  onSkip: () => void;
  onClaimReward: (id: string) => void;
  claimInFlight?: boolean;
}) {
  const rewardChoices = rewardState.choices;
  const rewardGold = rewardState.gold;
  const rewardMaterials = rewardState.materials;
  const choicePrompt = getRewardPrompt(rewardState.rewardType);

  const hoveredCardId = useUiStore((s) => s.hoveredCardId);
  const hoveredReward = useMemo(() => {
    const hoveredId = hoveredCardId?.startsWith("reward-") ? hoveredCardId.slice("reward-".length) : null;
    return hoveredId === null ? null : resolveRewardChoice(rewardState, hoveredId);
  }, [hoveredCardId, rewardState]);

  const claimLocked = claimInFlight || rewardChoices.length === 0;
  const skipDisabled = claimInFlight;
  const showSkip = rewardState.rewardType === "card" || rewardChoices.length === 0;
  usePlasmaInteraction(getRewardColorPair(hoveredReward), hoveredReward !== null);

  return (
    <TitledScreenShell title="Victory" maxWidthClass="max-w-6xl">
      <FadeSlot
        swapKey={`${rewardState.rewardType}:${rewardChoices.map((item) => getRewardChoiceId(item)).join("-")}`}
        className="flex flex-col"
      >
        <h2 className={cn("mt-3 text-center font-sans", sectionTitleClass)}>{choicePrompt}</h2>
        <div className="mt-8 flex flex-col items-center gap-8">
          <div className="flex flex-wrap items-start justify-center gap-6">
            <RewardChoiceItems rewardState={rewardState} disabled={claimLocked} onClaimReward={onClaimReward} />
          </div>
          <RewardsFound rewardGold={rewardGold} rewardMaterials={rewardMaterials} />
        </div>
        {showSkip ? (
          <div className="mt-5 flex justify-center">
            <Button
              variant="outline"
              size="lg"
              className={BUTTON_WIDTH_ACTION}
              disabled={skipDisabled}
              onClick={onSkip}
            >
              Skip
            </Button>
          </div>
        ) : null}
      </FadeSlot>
    </TitledScreenShell>
  );
}
