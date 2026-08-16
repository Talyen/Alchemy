import { cn } from "@/lib/utils";
import { type ReactNode } from "react";
import { type MaterialInventory } from "@/lib/homestead/types";
import { canAfford } from "@/lib/homestead/inventory";
import { Button } from "@/components/ui/button";
import { DetailPopup } from "../../../shared/ui/card-popup";
import { DisabledTooltip } from "../../../shared/ui/shared-ui";
import { type PopupContext } from "../../../shared/ui/interactive-art-tile";
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
  bondCost: MaterialInventory,
  bondAffordable: boolean,
  onBond: (card: BattleCard) => void,
): ReactNode {
  if (!discovered) {
    return null;
  }
  if (isComplete) {
    return <HomesteadTileCompletedFooter label={card.title} wrapperClassName="mt-0.5" />;
  }
  return (
    <div className="mt-0.5 flex items-center gap-2">
      <DisabledTooltip show={!bondAffordable} message="Not Enough Resources">
        <Button variant="outline" size="lg" disabled={!bondAffordable} onClick={() => onBond(card)}>
          {card.title}
          <MaterialCost material="food" amount={bondCost.food} />
        </Button>
      </DisabledTooltip>
    </div>
  );
}

function getCompanionTooltip(
  card: BattleCard,
  discovered: boolean,
  currentLevel: number,
  bondedCompanions: Record<CompanionId, number>,
): (ctx: PopupContext) => ReactNode {
  const title = discovered ? (
    <span className="inline-flex items-center gap-2">
      {card.title}
      <StarRating current={currentLevel} max={COMPANION_MAX_TIER} className="h-3.5 w-3.5" />
    </span>
  ) : (
    "Undiscovered"
  );

  return ({ visible, triggerRef }) => (
    <DetailPopup
      idPrefix={card.id}
      title={title}
      subtitle={undefined}
      descriptionLines={
        visible
          ? discovered
            ? getEffectiveCardDescriptionLines(card, { companionBondLevels: bondedCompanions })
            : ["Discover this card during a run to reveal it here."]
          : []
      }
      visible={visible}
      triggerRef={triggerRef}
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

  const detailTooltip = getCompanionTooltip(card, discovered, currentLevel, bondedCompanions);
  const footer = getCompanionFooter(discovered, isComplete, card, bondCost, bondAffordable, onBond);

  return (
    <HomesteadTileFrame
      id={card.id}
      index={index}
      hoveredItemId={hoveredItemId}
      setHoveredItemId={setHoveredItemId}
      detailTooltip={detailTooltip}
      wrapperClassName="p-2.5"
      surfaceClassName={cn(
        HOMESTEAD_CONFIG.companionPageWidth,
        HOMESTEAD_CONFIG.companionAspectRatio,
        isComplete && "bg-stone-800/70",
      )}
      imageSrc={card.art}
      imageAlt={card.title}
      imageClassName={cn("h-full w-full object-cover", !discovered && "opacity-45 grayscale")}
      footer={footer}
    />
  );
}
