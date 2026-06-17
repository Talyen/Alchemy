// Victory reward screen — pick a card or trinket to add or skip.
import type { BattleCard, TrinketEntry } from "@/lib/game-data";
import { gearDefinitions, getGearInstanceDescriptionLines, getGearInstanceTitle, type GearInstance } from "@/lib/gear";
import { cn } from "@/lib/utils";
import { MATERIAL_IDS } from "@/lib/homestead/types";
import { GoldPill, MaterialPill } from "../../shared/ui/material-icons";

import { BattleCardButton } from "../../shared/ui/card-button";
import { getCardDisplayTitle } from "../../shared/ui/card-description-ui";
import { DetailPopup } from "../../shared/ui/card-popup";
import { ActionButtonRow, ScreenHeader, StaggerGroup, StaggerItem } from "../../shared/ui/shared-ui";
import { TiltSurface } from "../../shared/ui/tilt-surface";
import { cardSurfaceClass, collectionTileWidthClass } from "@/features/alchemy/shared/config";
import {
  getRewardChoiceId,
  type RewardState,
  type GearRewardState,
  type TrinketRewardState,
} from "../navigation/reward-flow";
import { useInteractiveCard } from "../../shared/ui/use-interactive-card";

function TrinketRewardButton({
  trinket,
  onClick,
  selected,
}: {
  trinket: TrinketEntry;
  onClick: () => void;
  selected: boolean;
}) {
  const { isHovered, onHoverStart, onHoverEnd, shimmerActive, shimmerToken } = useInteractiveCard("reward", trinket.id);

  return (
    <div className="relative" onMouseEnter={onHoverStart} onMouseLeave={onHoverEnd}>
      {isHovered ? (
        <DetailPopup
          idPrefix={trinket.id}
          title={trinket.title}
          subtitle={undefined}
          descriptionLines={trinket.descriptionLines}
        />
      ) : null}
      <TiltSurface
        as="button"
        className={cn(cardSurfaceClass, collectionTileWidthClass, "group")}
        shimmerActive={shimmerActive}
        shimmerToken={shimmerToken}
        selected={selected}
        onClick={onClick}
        ariaLabel={`Select ${trinket.title}`}
        onFocus={onHoverStart}
        onBlur={onHoverEnd}
      >
        <img
          src={trinket.art || undefined}
          alt={trinket.title}
          className="block w-full rounded-shell-hero aspect-square"
        />
      </TiltSurface>
    </div>
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
  const { isHovered, onHoverStart, onHoverEnd, shimmerActive, shimmerToken } = useInteractiveCard(
    "reward",
    instance.instanceId,
  );
  return (
    <div className="relative" onMouseEnter={onHoverStart} onMouseLeave={onHoverEnd}>
      {isHovered ? (
        <DetailPopup
          idPrefix={instance.instanceId}
          title={title}
          subtitle="Permanent Gear"
          descriptionLines={descriptionLines}
        />
      ) : null}
      <TiltSurface
        as="button"
        className={cn(cardSurfaceClass, collectionTileWidthClass, "group")}
        shimmerActive={shimmerActive}
        shimmerToken={shimmerToken}
        selected={selected}
        onClick={onClick}
        ariaLabel={`Select ${title}`}
        onFocus={onHoverStart}
        onBlur={onHoverEnd}
      >
        <img src={art} alt={title} className="block w-full rounded-shell-hero aspect-square" />
      </TiltSurface>
    </div>
  );
}

function RewardCardItem({
  card,
  selected,
  onSelect,
}: {
  card: BattleCard;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const { isHovered, onHoverStart, onHoverEnd, shimmerActive, shimmerToken } = useInteractiveCard("reward", card.id);

  return (
    <BattleCardButton
      card={card}
      hovered={isHovered}
      onHoverStart={onHoverStart}
      onHoverEnd={onHoverEnd}
      onClick={() => onSelect(card.id)}
      ariaLabel={`Select ${getCardDisplayTitle(card)}`}
      shimmerActive={shimmerActive}
      shimmerToken={shimmerToken}
      className={collectionTileWidthClass}
      wrapperClassName="relative flex justify-center"
      selected={selected}
    />
  );
}

export function RewardsScreen({
  rewardState,
  onAddReward,
  onSkip,
  onSelectReward,
  allowTrinketSkip = false,
}: {
  rewardState: RewardState;
  onAddReward: () => void;
  onSkip: () => void;
  onSelectReward: (id: string) => void;
  allowTrinketSkip?: boolean;
}) {
  const rewardType = rewardState.rewardType;
  const rewardChoices = rewardState.choices;
  const rewardGold = rewardState.gold;
  const rewardMaterials = rewardState.materials;
  const selectedRewardId = rewardState.selectedId;
  const isTrinket = rewardType === "trinket";
  const isGear = rewardType === "gear";
  const selectedRewardItem = selectedRewardId
    ? (rewardChoices.find((item) => getRewardChoiceId(item) === selectedRewardId) ?? null)
    : null;

  return (
    <div className="flex h-full w-full items-center justify-center px-4 py-6">
      <div className="alchemy-shell w-full max-w-6xl rounded-shell-hero border border-border/80 p-7 text-center">
        <ScreenHeader title="Victory" />
        <p className="mt-3 text-base text-muted-foreground">
          {isGear
            ? "Choose permanent Gear for your Armory"
            : isTrinket
              ? "Choose a Trinket to add to your Collection"
              : "Choose a Card to add to your Deck"}
        </p>

        <StaggerGroup
          swapKey={rewardChoices.map((item) => getRewardChoiceId(item)).join("-")}
          className="mt-8 flex flex-col items-center gap-8"
        >
          <div className="flex flex-wrap items-start justify-center gap-6">
            {rewardChoices.map((item, index) => {
              const choiceId = getRewardChoiceId(item);
              return (
                <StaggerItem key={choiceId} index={index}>
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
                    <RewardCardItem
                      card={item as BattleCard}
                      selected={selectedRewardId === choiceId}
                      onSelect={onSelectReward}
                    />
                  )}
                </StaggerItem>
              );
            })}
          </div>

          {rewardGold > 0 || MATERIAL_IDS.some((mat) => rewardMaterials[mat] > 0) ? (
            <StaggerItem
              index={rewardChoices.length}
              className="flex flex-wrap items-center justify-center gap-2 text-sm font-medium text-muted-foreground"
            >
              Found
              {rewardGold > 0 ? <GoldPill amount={rewardGold} /> : null}
              {MATERIAL_IDS.filter((mat) => rewardMaterials[mat] > 0).map((mat) => (
                <MaterialPill key={mat} material={mat} amount={rewardMaterials[mat]} />
              ))}
            </StaggerItem>
          ) : null}
        </StaggerGroup>

        <ActionButtonRow
          className="mt-5"
          width="action"
          {...((!isTrinket && !isGear) || allowTrinketSkip ? { secondary: { label: "Skip", onClick: onSkip } } : {})}
          primary={{
            label: isGear ? "Take Gear" : isTrinket ? "Take Trinket" : "Add Card",
            disabled: !selectedRewardItem,
            onClick: onAddReward,
          }}
        />
      </div>
    </div>
  );
}
