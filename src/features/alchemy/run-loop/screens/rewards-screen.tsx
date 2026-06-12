// Victory reward screen — pick a card or trinket to add or skip.
import { Button } from "@/components/ui/button";
import type { BattleCard, TrinketEntry } from "@/lib/game-data";
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
  const selectedRewardItem = selectedRewardId
    ? (rewardChoices.find((item) => "id" in item && item.id === selectedRewardId) ?? null)
    : null;

  return (
    <div className="flex h-full w-full items-center justify-center px-4 py-6">
      <div className="alchemy-shell w-full max-w-6xl rounded-shell-hero border border-border/80 p-7 text-center">
        <ScreenHeader title="Victory" />
        <p className="mt-3 text-base text-muted-foreground">
          {isTrinket ? "Choose a Trinket to add to your Collection" : "Choose a Card to add to your Deck"}
        </p>

        <StaggerGroup
          swapKey={rewardChoices.map((item) => item.id).join("-")}
          className="mt-8 flex flex-col items-center gap-8"
        >
          <div className="flex flex-wrap items-start justify-center gap-6">
            {rewardChoices.map((item, index) => (
              <StaggerItem key={item.id} index={index}>
                {isTrinket ? (
                  <TrinketRewardButton
                    trinket={item as TrinketEntry}
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
          {!isTrinket || allowTrinketSkip ? (
            <Button size="lg" variant="outline" className="min-w-40" onClick={onSkip}>
              Skip
            </Button>
          ) : null}
          <Button size="lg" className="min-w-40" disabled={!selectedRewardItem} onClick={onAddReward}>
            {isTrinket ? "Take Trinket" : "Add Card"}
          </Button>
        </div>
      </div>
    </div>
  );
}
