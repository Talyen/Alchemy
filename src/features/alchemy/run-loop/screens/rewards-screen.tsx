// Victory reward screen — pick a card or boon to add or skip.
import { Button } from "@/components/ui/button";
import type { BattleCard, BoonEntry } from "@/lib/game-data";
import type { GearDefinition } from "@/lib/gear";
import { cn } from "@/lib/utils";
import { MATERIAL_IDS } from "@/lib/homestead/types";
import { GoldPill, MaterialPill } from "../../shared/ui/material-icons";

import { BattleCardButton } from "../../shared/ui/card-button";
import { getCardDisplayTitle } from "../../shared/ui/card-description-ui";
import { DetailPopup } from "../../shared/ui/card-popup";
import { ScreenHeader, StaggerGroup, StaggerItem } from "../../shared/ui/shared-ui";
import { TiltSurface } from "../../shared/ui/tilt-surface";
import { cardSurfaceClass, collectionTileWidthClass } from "@/features/alchemy/shared/config";
import type { RewardState } from "../navigation/reward-flow";
import { useInteractiveCard } from "../../shared/ui/use-interactive-card";

function BoonRewardButton({ boon, onClick, selected }: { boon: BoonEntry; onClick: () => void; selected: boolean }) {
  const { isHovered, onHoverStart, onHoverEnd, shimmerActive, shimmerToken } = useInteractiveCard("reward", boon.id);

  return (
    <div className="relative" onMouseEnter={onHoverStart} onMouseLeave={onHoverEnd}>
      {isHovered ? (
        <DetailPopup
          idPrefix={boon.id}
          title={boon.title}
          subtitle={undefined}
          descriptionLines={boon.descriptionLines}
        />
      ) : null}
      <TiltSurface
        as="button"
        className={cn(cardSurfaceClass, collectionTileWidthClass, "group")}
        shimmerActive={shimmerActive}
        shimmerToken={shimmerToken}
        selected={selected}
        onClick={onClick}
        ariaLabel={`Select ${boon.title}`}
        onFocus={onHoverStart}
        onBlur={onHoverEnd}
      >
        <img src={boon.art || undefined} alt={boon.title} className="block w-full rounded-shell-hero aspect-square" />
      </TiltSurface>
    </div>
  );
}

function GearRewardButton({
  gear,
  onClick,
  selected,
}: {
  gear: GearDefinition;
  onClick: () => void;
  selected: boolean;
}) {
  const { isHovered, onHoverStart, onHoverEnd, shimmerActive, shimmerToken } = useInteractiveCard("reward", gear.id);
  return (
    <div className="relative" onMouseEnter={onHoverStart} onMouseLeave={onHoverEnd}>
      {isHovered ? (
        <DetailPopup
          idPrefix={gear.id}
          title={gear.title}
          subtitle="Permanent Gear"
          descriptionLines={gear.descriptionLines}
        />
      ) : null}
      <TiltSurface
        as="button"
        className={cn(cardSurfaceClass, collectionTileWidthClass, "group")}
        shimmerActive={shimmerActive}
        shimmerToken={shimmerToken}
        selected={selected}
        onClick={onClick}
        ariaLabel={`Select ${gear.title}`}
        onFocus={onHoverStart}
        onBlur={onHoverEnd}
      >
        <img src={gear.art} alt={gear.title} className="block w-full rounded-shell-hero aspect-square" />
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
  allowBoonSkip = false,
}: {
  rewardState: RewardState;
  onAddReward: () => void;
  onSkip: () => void;
  onSelectReward: (id: string) => void;
  allowBoonSkip?: boolean;
}) {
  const rewardType = rewardState.rewardType;
  const rewardChoices = rewardState.choices;
  const rewardGold = rewardState.gold;
  const rewardMaterials = rewardState.materials;
  const selectedRewardId = rewardState.selectedId;
  const isBoon = rewardType === "boon";
  const isGear = rewardType === "gear";
  const selectedRewardItem = selectedRewardId
    ? (rewardChoices.find((item) => "id" in item && item.id === selectedRewardId) ?? null)
    : null;

  return (
    <div className="flex h-full w-full items-center justify-center px-4 py-6">
      <div className="alchemy-shell w-full max-w-6xl rounded-shell-hero border border-border/80 p-7 text-center">
        <ScreenHeader title="Victory" />
        <p className="mt-3 text-base text-muted-foreground">
          {isGear
            ? "Choose permanent Gear for your Armory"
            : isBoon
              ? "Choose a Boon to add to your Collection"
              : "Choose a Card to add to your Deck"}
        </p>

        <StaggerGroup
          swapKey={rewardChoices.map((item) => item.id).join("-")}
          className="mt-8 flex flex-col items-center gap-8"
        >
          <div className="flex flex-wrap items-start justify-center gap-6">
            {rewardChoices.map((item, index) => (
              <StaggerItem key={item.id} index={index}>
                {isGear ? (
                  <GearRewardButton
                    gear={item as GearDefinition}
                    onClick={() => onSelectReward(item.id)}
                    selected={selectedRewardId === item.id}
                  />
                ) : isBoon ? (
                  <BoonRewardButton
                    boon={item as BoonEntry}
                    onClick={() => onSelectReward(item.id)}
                    selected={selectedRewardId === item.id}
                  />
                ) : (
                  <RewardCardItem
                    card={item as BattleCard}
                    selected={selectedRewardId === item.id}
                    onSelect={onSelectReward}
                  />
                )}
              </StaggerItem>
            ))}
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

        <div className="mt-5 flex flex-wrap justify-center gap-3">
          {(!isBoon && !isGear) || allowBoonSkip ? (
            <Button size="lg" variant="outline" className="min-w-40" onClick={onSkip}>
              Skip
            </Button>
          ) : null}
          <Button size="lg" className="min-w-40" disabled={!selectedRewardItem} onClick={onAddReward}>
            {isGear ? "Take Gear" : isBoon ? "Take Boon" : "Add Card"}
          </Button>
        </div>
      </div>
    </div>
  );
}
