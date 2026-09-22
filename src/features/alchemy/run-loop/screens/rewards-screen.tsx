import { useMemo } from "react";
import { useUiStore } from "../../shared/stores/ui-store";
import { getCardKeywords } from "@/lib/game-data";
import { getGearInstanceTitle } from "@/lib/gear";
import { cn } from "@/lib/utils";
import { MATERIAL_IDS, type MaterialId } from "@/lib/homestead/types";

import { GearTile, TrinketTile } from "../../shared/ui/collection-art-tiles";
import { FoundResourcesRow } from "../../shared/ui/found-resources-row";
import { SelectableCard } from "../../shared/ui/cards/selectable-card";
import { Button } from "@/components/ui/button";
import { TitledScreenShell } from "../../shared/ui/layout-components";
import { usePlasmaInteraction } from "../../shared/ui/use-plasma-source";
import { FadeSlot } from "../../shared/ui/use-fade";
import {
  getPlasmaKeywordsForGear,
  getPlasmaColorPair,
  getCardInspectionShineColors,
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
  // Each choice cell shares the same flex centering so card, gear, and
  // trinket/boon tiles align identically; tile widths/aspects already match.
  switch (rewardState.rewardType) {
    case "gear":
      return rewardState.choices.map((instance) => {
        const choiceId = getRewardChoiceId(instance);
        return (
          <div key={choiceId} className="flex justify-center">
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
          <div key={choiceId} className="flex justify-center">
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
          <div key={choiceId} className="flex justify-center">
            <SelectableCard
              card={card}
              isSelected={false}
              disabled={disabled}
              shineColor={getCardInspectionShineColors(card)}
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
  // Reserve one pill-row height in both branches so gold/materials vs none
  // cannot move the choices or Skip footer. Matches ResourcePill md min-h.
  if (!hasRewards) {
    return (
      <div aria-hidden="true" className="flex min-h-[calc(52px*var(--content-scale,1))] items-center justify-center" />
    );
  }
  return (
    <div className="flex min-h-[calc(52px*var(--content-scale,1))] items-center justify-center">
      <FoundResourcesRow gold={rewardGold} materials={rewardMaterials} />
    </div>
  );
}

function RewardPlasmaController({ rewardState }: { rewardState: RewardState }) {
  const hoveredCardId = useUiStore((s) => s.hoveredCardId);
  const hoveredReward = useMemo(() => {
    const hoveredId = hoveredCardId?.startsWith("reward-") ? hoveredCardId.slice("reward-".length) : null;
    return hoveredId === null ? null : resolveRewardChoice(rewardState, hoveredId);
  }, [hoveredCardId, rewardState]);
  usePlasmaInteraction(getRewardColorPair(hoveredReward), hoveredReward !== null);
  return null;
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

  const claimLocked = claimInFlight || rewardChoices.length === 0;
  const skipDisabled = claimInFlight;
  const showSkip = rewardState.rewardType === "card" || rewardChoices.length === 0;

  return (
    <TitledScreenShell title="Victory" maxWidthClass="max-w-6xl">
      <RewardPlasmaController rewardState={rewardState} />
      <FadeSlot
        swapKey={`${rewardState.rewardType}:${rewardChoices.map((item) => getRewardChoiceId(item)).join("-")}`}
        className="flex flex-col"
      >
        <h2 className={cn("mt-3 text-center font-sans", sectionTitleClass)}>Choose a Reward</h2>
        <div className="mt-8 flex flex-col items-center gap-8">
          {/* Reserve one tile row (collection width 17.2868rem at 3/4 aspect) so
              1-2 choice, empty, and 3-choice states share the same height. */}
          <div className="flex min-h-[calc(23.05*var(--content-rem,1rem))] flex-wrap items-start justify-center gap-6">
            <RewardChoiceItems rewardState={rewardState} disabled={claimLocked} onClaimReward={onClaimReward} />
          </div>
          <RewardsFound rewardGold={rewardGold} rewardMaterials={rewardMaterials} />
        </div>
        {/* Always reserve Skip footer height; spacer keeps gear/trinket/boon
            aligned with card rewards without adding a second Skip action. */}
        <div className="mt-5 flex min-h-16 justify-center">
          {showSkip ? (
            <Button variant="outline" size="lg" className="min-w-56" disabled={skipDisabled} onClick={onSkip}>
              Skip
            </Button>
          ) : (
            <div aria-hidden="true" className="h-16" />
          )}
        </div>
      </FadeSlot>
    </TitledScreenShell>
  );
}
