// Victory reward screen — pick a card or trinket to add or skip.
import type { CSSProperties } from "react";
import { Coins } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { BattleCard, TrinketEntry } from "@/lib/game-data";
import { cn } from "@/lib/utils";
import { MATERIAL_IDS, materialLabels, type MaterialInventory } from "@/lib/homestead/types";
import { matIconMap, matPillStyle, matTextColor } from "../ui/material-icons";

import { BattleCardButton, DetailPopup } from "../ui/card-ui";
import { ScreenHeader, ShimmerOverlay } from "../ui/shared-ui";
import { cardSurfaceClass, collectionCardWidthClass, staticCardTransform } from "../config";
import { clearTiltFromEvent, getHoverId, setTiltFromEvent } from "../utils";

function TrinketRewardButton({
  trinket,
  hovered,
  onHoverStart,
  onHoverEnd,
  onClick,
  shimmerActive,
  shimmerToken,
  selected,
}: {
  trinket: TrinketEntry;
  hovered: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  onClick: () => void;
  shimmerActive: boolean;
  shimmerToken: number | undefined;
  selected: boolean;
}) {
  return (
    <div className="relative" onMouseEnter={onHoverStart} onMouseLeave={onHoverEnd}>
      {hovered ? (
        <DetailPopup idPrefix={trinket.id} title={trinket.title} subtitle={undefined} descriptionLines={trinket.descriptionLines} />
      ) : null}
      <button
        type="button"
        aria-label={`Select ${trinket.title}`}
        onClick={onClick}
        onFocus={onHoverStart}
        onBlur={onHoverEnd}
        onMouseMove={setTiltFromEvent}
        onMouseLeave={clearTiltFromEvent}
        data-tilt-strength="11"
        className={cn(
          "tilt-surface group w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          cardSurfaceClass,
          collectionCardWidthClass,
          selected ? "ring-2 ring-primary ring-offset-4 ring-offset-background" : null,
        )}
        style={{ "--card-base-transform": staticCardTransform } as CSSProperties}
      >
        <ShimmerOverlay active={shimmerActive} token={shimmerToken} />
        <img
          src={trinket.art}
          alt={trinket.title}
          className="block w-full rounded-[30px] aspect-square"
          loading="lazy"
        />
      </button>
    </div>
  );
}

export function RewardsScreen({
  rewardType,
  rewardChoices,
  rewardGold,
  rewardMaterials,
  hoveredCardId,
  onHoverChange,
  shimmerState,
  onHoverShimmer,
  selectedRewardId,
  onSelectReward,
  onAddReward,
  onSkip,
}: {
  rewardType: "card" | "trinket";
  rewardChoices: (BattleCard | TrinketEntry)[];
  rewardGold: number;
  rewardMaterials: MaterialInventory;
  hoveredCardId: string | null;
  onHoverChange: (value: string | null | ((current: string | null) => string | null)) => void;
  shimmerState: { cardId: string; token: number } | null;
  onHoverShimmer: (cardId: string) => void;
  selectedRewardId: string | null;
  onSelectReward: (cardId: string) => void;
  onAddReward: () => void;
  onSkip: () => void;
}) {
  const isTrinket = rewardType === "trinket";
  const selectedRewardItem = selectedRewardId ? rewardChoices.find((item) => item.id === selectedRewardId) ?? null : null;

  return (
    <div className="flex h-full w-full items-center justify-center px-4 py-6">
      <div className="alchemy-shell w-full max-w-6xl rounded-[30px] border border-border/80 px-6 py-7 text-center sm:px-8">
        <ScreenHeader title="Victory" />
        <p className="mt-3 text-base text-muted-foreground">
          {isTrinket ? "Choose a Trinket to add to your Collection" : "Choose a Card to add to your Deck"}
        </p>

        <div className="mt-8 flex flex-wrap items-start justify-center gap-6">
          {rewardChoices.map((item, index) => {
            const hoverId = getHoverId("reward", item.id);

            if (isTrinket) {
              const trinket = item as TrinketEntry;
              return (
                <TrinketRewardButton
                  key={trinket.id}
                  trinket={trinket}
                  hovered={hoveredCardId === hoverId}
                  onHoverStart={() => { onHoverChange(hoverId); onHoverShimmer(hoverId); }}
                  onHoverEnd={() => onHoverChange((current) => (current === hoverId ? null : current))}
                  onClick={() => onSelectReward(trinket.id)}
                  shimmerActive={shimmerState?.cardId === hoverId}
                  shimmerToken={shimmerState?.token}
                  selected={selectedRewardId === trinket.id}
                />
              );
            }

            const card = item as BattleCard;
            return (
              <BattleCardButton
                key={card.id}
                card={card}
                hovered={hoveredCardId === hoverId}
                onHoverStart={() => { onHoverChange(hoverId); onHoverShimmer(hoverId); }}
                onHoverEnd={() => onHoverChange((current) => (current === hoverId ? null : current))}
                onClick={() => onSelectReward(card.id)}
                ariaLabel={`Select ${card.title}`}
                tiltStrength={15}
                shimmerActive={shimmerState?.cardId === hoverId}
                shimmerToken={shimmerState?.token}
                className={collectionCardWidthClass}
                wrapperClassName="stagger-item relative flex justify-center"
                wrapperStyle={{ "--stagger-index": index } as CSSProperties}
                selected={selectedRewardId === card.id}
              />
            );
          })}
        </div>

        {(rewardGold > 0 || MATERIAL_IDS.some((mat) => rewardMaterials[mat] > 0)) ? (
          <div className="state-swap mt-8 flex flex-col items-center gap-2 text-sm font-medium">
            {rewardGold > 0 ? (
              <span className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
                Found
                <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-yellow-300/15 text-yellow-300">
                  <Coins className="h-4 w-4" />
                  {rewardGold} Gold
                </span>
              </span>
            ) : null}
            {MATERIAL_IDS.filter((mat) => rewardMaterials[mat] > 0).map((mat) => (
              <span key={mat} className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
                Found
                <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold", matPillStyle[mat], matTextColor[mat])}>
                  {matIconMap[mat]}
                  {rewardMaterials[mat]} {materialLabels[mat]}
                </span>
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Button size="lg" className="min-w-40" disabled={!selectedRewardItem} onClick={onAddReward}>
            {isTrinket ? "Take Trinket" : "Add Card"}
          </Button>
          <Button size="lg" variant="outline" className="min-w-40" onClick={onSkip}>
            Skip
          </Button>
        </div>
      </div>
    </div>
  );
}
