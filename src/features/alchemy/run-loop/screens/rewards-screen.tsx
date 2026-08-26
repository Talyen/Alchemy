import { useMemo } from "react";
import { useUiStore } from "../../shared/stores/ui-store";
import { getCardKeywords, type BattleCard, type TrinketEntry } from "@/lib/game-data";
import { getGearInstanceTitle, type GearInstance } from "@/lib/gear";
import { cn } from "@/lib/utils";
import { MATERIAL_IDS, type MaterialId } from "@/lib/homestead/types";

import { GearTile, TrinketTile } from "../../shared/ui/collection-art-tiles";
import { FoundResourcesRow } from "../../shared/ui/found-resources-row";
import { SelectableCard } from "../../shared/ui/selectable-card";
import { ActionButtonRow, TitledScreenShell } from "../../shared/ui/shared-ui";
import { usePlasmaBaseline, usePlasmaInteraction } from "../../shared/ui/use-plasma-source";
import { FadeSlot } from "../../shared/ui/fade-slot";
import { getPlasmaKeywordsForGear, getPlasmaColorPair, sectionTitleClass } from "@/features/alchemy/shared/config";
import { getTrinketKeywords } from "@/features/alchemy/shared/config/game-data-catalog";
import { getRewardChoiceId, type RewardState } from "@/lib/active-run-session";

function RewardChoiceItems({
  choices,
  rewardType,
  selectedRewardId,
  onSelectReward,
}: {
  choices: RewardState["choices"];
  rewardType: string;
  selectedRewardId: string | null;
  onSelectReward: (id: string) => void;
}) {
  const isTrinket = rewardType === "trinket";
  const isBoon = rewardType === "boon";
  const isGear = rewardType === "gear";
  return choices.map((item) => {
    const choiceId = getRewardChoiceId(item);
    const selected = selectedRewardId === choiceId;
    return (
      <div key={choiceId}>
        {isGear ? (
          <GearTile
            instance={item as GearInstance}
            interactionKey="reward"
            as="button"
            selected={selected}
            onClick={() => onSelectReward(choiceId)}
            ariaLabel={`Select ${getGearInstanceTitle(item as GearInstance)}`}
          />
        ) : isTrinket || isBoon ? (
          <TrinketTile
            trinket={item as TrinketEntry}
            interactionKey="reward"
            as="button"
            selected={selected}
            temporary={isBoon}
            onClick={() => onSelectReward(choiceId)}
            ariaLabel={`Select ${(item as TrinketEntry).title}`}
          />
        ) : (
          <SelectableCard
            card={item as BattleCard}
            isSelected={selected}
            onSelect={() => onSelectReward(choiceId)}
            interactionKey="reward"
          />
        )}
      </div>
    );
  });
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
    return <div className="min-h-[2.5rem]" />;
  }
  return <FoundResourcesRow gold={rewardGold} materials={rewardMaterials} />;
}

export function RewardsScreen({
  rewardState,
  onAddReward,
  onSkip,
  onSelectReward,
  claimInFlight = false,
  onOpenMenu,
}: {
  rewardState: RewardState;
  onAddReward: () => void;
  onSkip: () => void;
  onSelectReward: (id: string) => void;
  claimInFlight?: boolean;
  onOpenMenu: (rect?: DOMRect) => void;
}) {
  const rewardType = rewardState.rewardType;
  const rewardChoices = rewardState.choices;
  const rewardGold = rewardState.gold;
  const rewardMaterials = rewardState.materials;
  const selectedRewardId = rewardState.selectedId;
  const isTrinket = rewardType === "trinket";
  const isBoon = rewardType === "boon";
  const isGear = rewardType === "gear";
  const choicePrompt = isGear
    ? "Add Gear to your Armory"
    : isTrinket
      ? "Choose a Trinket to add to your Armory"
      : isBoon
        ? "Choose a Boon for this Run"
        : "Add a Card to your Deck";

  // Read which reward choice is hovered directly from the ui-store hover ID.
  // Cards register under scope "reward" so their hover ID is "reward-{choiceId}".
  // Reading from the store avoids the leave/enter callback ordering race that
  // causes the local state to momentarily clear between card transitions.
  const hoveredCardId = useUiStore((s) => s.hoveredCardId);
  const { hoveredRewardItem, selectedRewardItem } = useMemo(() => {
    let hovered: RewardState["choices"][number] | null = null;
    let selected: RewardState["choices"][number] | null = null;
    for (const item of rewardChoices) {
      const choiceId = getRewardChoiceId(item);
      if (hoveredCardId === `reward-${choiceId}`) hovered = item;
      if (selectedRewardId === choiceId) selected = item;
    }
    return { hoveredRewardItem: hovered, selectedRewardItem: selected };
  }, [hoveredCardId, selectedRewardId, rewardChoices]);

  const claimLocked = claimInFlight || rewardChoices.length === 0;
  const getRewardColorPair = (item: BattleCard | TrinketEntry | GearInstance | null) => {
    if (!item) return null;
    const keywords = isGear
      ? getPlasmaKeywordsForGear(item as GearInstance)
      : isTrinket || isBoon
        ? getTrinketKeywords((item as TrinketEntry).id)
        : getCardKeywords(item as BattleCard);
    return getPlasmaColorPair(keywords);
  };
  usePlasmaBaseline(getRewardColorPair(selectedRewardItem));
  usePlasmaInteraction(getRewardColorPair(hoveredRewardItem), hoveredRewardItem !== null);

  return (
    <TitledScreenShell title="Victory" onOpenMenu={onOpenMenu} menuLabel="Open rewards menu" maxWidthClass="max-w-6xl">
      <h2 className={cn("mt-3 text-center font-sans", sectionTitleClass)}>{choicePrompt}</h2>

      <FadeSlot
        swapKey={rewardChoices.map((item) => getRewardChoiceId(item)).join("-")}
        className="mt-8 flex flex-col items-center gap-8"
      >
        <div className="flex flex-wrap items-start justify-center gap-6">
          <RewardChoiceItems
            choices={rewardChoices}
            rewardType={rewardType}
            selectedRewardId={selectedRewardId}
            onSelectReward={onSelectReward}
          />
        </div>

        <RewardsFound rewardGold={rewardGold} rewardMaterials={rewardMaterials} />
      </FadeSlot>

      <ActionButtonRow
        className="mt-5"
        width="action"
        {...(!isTrinket && !isBoon && !isGear
          ? {
              secondary: {
                label: "Skip",
                onClick: onSkip,
                // Disabled while claim is in flight or after commit drains choices.
                disabled: claimLocked,
              },
            }
          : {})}
        primary={{
          label: isGear ? "Take Gear" : isTrinket ? "Take Trinket" : isBoon ? "Take Boon" : "Add Card",
          disabled: !selectedRewardItem || claimLocked,
          onClick: onAddReward,
        }}
      />
    </TitledScreenShell>
  );
}
