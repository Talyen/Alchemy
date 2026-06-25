import { cn } from "@/lib/utils";
import { type ReactNode } from "react";
import { type MaterialInventory } from "@/lib/homestead/types";
import { canAfford } from "@/lib/homestead/inventory";
import { Button } from "@/components/ui/button";
import { DetailPopup } from "../../../shared/ui/card-popup";
import { DisabledTooltip } from "../../../shared/ui/shared-ui";
import { StarRating } from "../../../shared/ui/star-rating";
import { type BattleCard, type CompanionId } from "@/lib/game-data";
import { COMPANION_BOND_TIERS, COMPANION_MAX_TIER } from "@/lib/homestead/companions";
import { getEffectiveCardDescriptionLines } from "../../../shared/utils/card-description";
import { HOMESTEAD_CONFIG, MaterialCost } from "./helpers";
import { HomesteadTileCompletedFooter, HomesteadTileFrame } from "./homestead-tile-node";

function getCompanionFooter(
  discovered: boolean,
  isComplete: boolean,
  card: BattleCard,
  currentLevel: number,
  bondCost: MaterialInventory,
  bondAffordable: boolean,
  onBond: (card: BattleCard) => void,
): ReactNode {
  if (!discovered || isComplete) {
    return (
      <HomesteadTileCompletedFooter
        label={discovered ? card.title : "Undiscovered"}
        stars={discovered ? <StarRating current={COMPANION_MAX_TIER} max={COMPANION_MAX_TIER} /> : null}
        wrapperClassName="mt-0.5"
      />
    );
  }
  return (
    <div className="mt-0.5 flex items-center gap-2">
      <DisabledTooltip show={!bondAffordable} message="Not Enough Resources">
        <Button variant="outline" disabled={!bondAffordable} onClick={() => onBond(card)}>
          {card.title}
          <MaterialCost material="food" amount={bondCost.food} />
        </Button>
      </DisabledTooltip>
      <StarRating current={currentLevel} max={COMPANION_MAX_TIER} />
    </div>
  );
}

function getCompanionTooltip(
  hoveredItemId: string | null,
  card: BattleCard,
  discovered: boolean,
  bondedCompanions: Record<CompanionId, number>,
): ReactNode {
  if (hoveredItemId !== card.id) return null;
  return (
    <DetailPopup
      idPrefix={card.id}
      title={discovered ? card.title : "Undiscovered"}
      subtitle={undefined}
      descriptionLines={
        discovered
          ? getEffectiveCardDescriptionLines(card, { companionBondLevels: bondedCompanions })
          : ["Discover this card during a run to reveal it here."]
      }
    />
  );
}

export function CompanionCardNode({
  card,
  index,
  discovered,
  bondedCompanions,
  materialInventory,
  hoveredItemId,
  setHoveredItemId,
  onBond,
}: {
  card: BattleCard;
  index: number;
  discovered: boolean;
  bondedCompanions: Record<CompanionId, number>;
  materialInventory: MaterialInventory;
  hoveredItemId: string | null;
  setHoveredItemId: (id: string | null) => void;
  onBond: (card: BattleCard) => void;
}) {
  const companionEffect = card.effects.find(
    (e): e is { kind: "summon-companion"; companionId: CompanionId } => e.kind === "summon-companion",
  );
  const companionId = companionEffect?.companionId ?? null;
  const currentLevel = companionId ? (bondedCompanions[companionId] ?? 0) : 0;
  const isComplete = currentLevel >= COMPANION_MAX_TIER;
  const bondTierIndex = Math.min(currentLevel, COMPANION_MAX_TIER - 1);
  const bondCost = COMPANION_BOND_TIERS[bondTierIndex];
  if (!bondCost) {
    throw new Error(`Missing companion bond tier at index ${bondTierIndex}`);
  }
  const bondAffordable = discovered && !isComplete && canAfford(materialInventory, bondCost);

  const detailTooltip = getCompanionTooltip(hoveredItemId, card, discovered, bondedCompanions);
  const footer = getCompanionFooter(discovered, isComplete, card, currentLevel, bondCost, bondAffordable, onBond);

  return (
    <HomesteadTileFrame
      id={card.id}
      index={index}
      hoveredItemId={hoveredItemId}
      setHoveredItemId={setHoveredItemId}
      detailTooltip={detailTooltip}
      wrapperClassName="p-1.5"
      surfaceClassName={cn(
        HOMESTEAD_CONFIG.companionPageWidth,
        HOMESTEAD_CONFIG.companionAspectRatio,
        isComplete && "bg-stone-800/70",
      )}
      imageSrc={card.art}
      imageAlt={card.title}
      imageClassName={cn("h-full w-full object-cover", !discovered && "grayscale opacity-45")}
      footer={footer}
    />
  );
}
