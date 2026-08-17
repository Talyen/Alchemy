// Victory reward screen — pick a card or trinket to add or skip.
import type { BattleCard, TrinketEntry } from "@/lib/game-data";
import {
  gearDefinitions,
  getAstralShineColors,
  getGearInstanceDescriptionLines,
  getGearInstanceTitle,
  type GearInstance,
} from "@/lib/gear";
import { cn } from "@/lib/utils";
import { MATERIAL_IDS, type MaterialId } from "@/lib/homestead/types";

import { DetailPopup } from "../../shared/ui/card-popup";
import { FoundResourcesRow } from "../../shared/ui/found-resources-row";
import { InteractiveArtTile } from "../../shared/ui/interactive-art-tile";
import { SelectableChoiceCard } from "../../shared/ui/selectable-choice-card";
import { ActionButtonRow, TitledScreenShell } from "../../shared/ui/shared-ui";
import { FadeSlot } from "../../shared/ui/fade-slot";
import {
  cardSurfaceClass,
  collectionTileWidthClass,
  gearArtAspectClass,
  gearArtFillClass,
  sectionTitleClass,
  trinketArtFillClass,
  trinketArtImageClass,
  trinketArtTileClass,
} from "@/features/alchemy/shared/config";
import {
  getRewardChoiceId,
  type GearRewardState,
  type RewardState,
  type TrinketRewardState,
} from "@/lib/active-run-session";

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
  const isGear = rewardType === "gear";
  return choices.map((item) => {
    const choiceId = getRewardChoiceId(item);
    return (
      <div key={choiceId}>
        {isGear ? (
          <GearRewardButton
            instance={item as GearRewardState["choices"][number]}
            onClick={() => onSelectReward(choiceId)}
            selected={selectedRewardId === choiceId}
          />
        ) : isTrinket ? (
          <TrinketRewardButton
            trinket={item as TrinketRewardState["choices"][number]}
            onClick={() => onSelectReward(choiceId)}
            selected={selectedRewardId === choiceId}
          />
        ) : (
          <SelectableChoiceCard
            card={item as BattleCard}
            selected={selectedRewardId === choiceId}
            onSelect={() => onSelectReward(choiceId)}
            interactionKey="reward"
            tiltEnabled={false}
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
    return <div className="min-h-[2.5rem]" aria-hidden="true" />;
  }
  return <FoundResourcesRow gold={rewardGold} materials={rewardMaterials} />;
}

function TrinketRewardButton({
  trinket,
  onClick,
  selected,
}: {
  trinket: TrinketEntry;
  onClick: () => void;
  selected: boolean;
}) {
  return (
    <InteractiveArtTile
      id={trinket.id}
      interactionKey="reward"
      title={trinket.title}
      art={trinket.art}
      className={trinketArtTileClass}
      imageClassName={cn(trinketArtFillClass, trinketArtImageClass)}
      selected={selected}
      onClick={onClick}
      ariaLabel={`Select ${trinket.title}`}
      popup={({ visible, triggerRef }) => (
        <DetailPopup
          idPrefix={trinket.id}
          title={trinket.title}
          footerChip="This Run"
          descriptionLines={trinket.descriptionLines}
          visible={visible}
          triggerRef={triggerRef}
        />
      )}
      as="button"
    />
  );
}

function GearRewardButton({
  instance,
  onClick,
  selected,
}: {
  instance: GearInstance;
  onClick: () => void;
  selected: boolean;
}) {
  const definition = gearDefinitions[instance.definitionId];
  const title = getGearInstanceTitle(instance);
  const art = definition?.art ?? "";
  const descriptionLines = getGearInstanceDescriptionLines(instance);
  return (
    <InteractiveArtTile
      id={instance.instanceId}
      interactionKey="reward"
      title={title}
      art={art}
      className={cn(cardSurfaceClass, collectionTileWidthClass, gearArtAspectClass)}
      imageClassName={gearArtFillClass}
      shineColor={getAstralShineColors(instance)}
      selected={selected}
      onClick={onClick}
      ariaLabel={`Select ${title}`}
      popup={({ visible, triggerRef }) => (
        <DetailPopup
          idPrefix={instance.instanceId}
          title={title}
          subtitle={undefined}
          descriptionLines={descriptionLines}
          visible={visible}
          triggerRef={triggerRef}
        />
      )}
      as="button"
    />
  );
}

export function RewardsScreen({
  rewardState,
  onAddReward,
  onSkip,
  onSelectReward,
  allowTrinketSkip = false,
  claimInFlight = false,
  onOpenMenu,
}: {
  rewardState: RewardState;
  onAddReward: () => void;
  onSkip: () => void;
  onSelectReward: (id: string) => void;
  allowTrinketSkip?: boolean;
  claimInFlight?: boolean;
  onOpenMenu: (rect?: DOMRect) => void;
}) {
  const rewardType = rewardState.rewardType;
  const rewardChoices = rewardState.choices;
  const rewardGold = rewardState.gold;
  const rewardMaterials = rewardState.materials;
  const selectedRewardId = rewardState.selectedId;
  const isTrinket = rewardType === "trinket";
  const isGear = rewardType === "gear";
  const choicePrompt = isGear
    ? "Add Gear to your Armory"
    : isTrinket
      ? "Gain a Trinket for this Run"
      : "Add a Card to your Deck";
  const selectedRewardItem = selectedRewardId
    ? (rewardChoices.find((item) => getRewardChoiceId(item) === selectedRewardId) ?? null)
    : null;
  const claimLocked = claimInFlight || rewardChoices.length === 0;

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
        {...((!isTrinket && !isGear) || allowTrinketSkip
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
          label: isGear ? "Take Gear" : isTrinket ? "Take Trinket" : "Add Card",
          disabled: !selectedRewardItem || claimLocked,
          onClick: onAddReward,
        }}
      />
    </TitledScreenShell>
  );
}
