import { useMemo, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { MATERIAL_IDS, type MaterialInventory } from "@/lib/homestead/types";
import { canAfford, emptyInventory } from "@/lib/homestead/inventory";
import { DetailPopup } from "../../../shared/ui/card-popup";
import { type PopupContext } from "../../../shared/ui/interactive-art-tile";
import { StarRating } from "../../../shared/ui/star-rating";
import { HOMESTEAD_CONFIG, type GoalItem, getArt, renderTextWithMaterials } from "./helpers";
import {
  HomesteadAffordButton,
  HomesteadTileCompletedFooter,
  HomesteadTileFrame,
  homesteadCompletedSurfaceClass,
  homesteadTileDimClass,
} from "./homestead-tile-node";

const ZERO_COST: MaterialInventory = emptyInventory();

export function HomesteadUpgradeNode({
  item,
  currentLevel,
  materialInventory,
  hoveredItemId,
  setHoveredItemId,
  onAction,
}: {
  item: GoalItem;
  currentLevel: number;
  materialInventory: MaterialInventory;
  hoveredItemId: string | null;
  setHoveredItemId: (id: string | null) => void;
  onAction: (item: GoalItem) => void;
}) {
  const maxTiers = item.data.tiers.length;
  const isTier0 = currentLevel === 0;
  const isCompleted = currentLevel >= maxTiers;
  const displayTierIndex = isCompleted ? maxTiers - 1 : Math.max(0, currentLevel - 1);
  const tier = item.data.tiers[isCompleted ? maxTiers - 1 : Math.min(currentLevel, maxTiers - 1)];
  const itemCost = tier?.cost ?? ZERO_COST;
  const itemAffordable = !isCompleted && canAfford(materialInventory, itemCost);

  const detailTooltip = useTooltipContent(item, displayTierIndex, currentLevel, maxTiers);
  const hasCost = MATERIAL_IDS.some((m) => (itemCost[m] ?? 0) > 0);

  const footer = isCompleted ? (
    <HomesteadTileCompletedFooter label={item.data.title} />
  ) : hasCost ? (
    <HomesteadAffordButton
      title={item.data.title}
      cost={itemCost}
      inventory={materialInventory}
      affordable={itemAffordable}
      onClick={() => onAction(item)}
    />
  ) : null;

  return (
    <HomesteadTileFrame
      id={item.data.id}
      hoveredItemId={hoveredItemId}
      setHoveredItemId={setHoveredItemId}
      detailTooltip={detailTooltip}
      surfaceClassName={cn(HOMESTEAD_CONFIG.artAspectRatio, "w-full", isCompleted && homesteadCompletedSurfaceClass)}
      imageSrc={getArt(item.data.id)}
      imageAlt={item.data.title}
      imageClassName={cn("h-full w-full object-cover", isTier0 && homesteadTileDimClass)}
      footer={footer}
    />
  );
}

function useTooltipContent(
  item: GoalItem,
  displayTierIndex: number,
  currentLevel: number,
  maxTiers: number,
): (ctx: PopupContext) => ReactNode {
  return useMemo(() => {
    const nodes: ReactNode[] = [];
    const currentTier = item.data.tiers[displayTierIndex];

    if (currentTier) {
      if (currentTier.benefitDescription) {
        for (const line of currentTier.benefitDescription.split("\n")) {
          nodes.push(
            <div key={`b-${nodes.length}`} className="text-balance">
              {renderTextWithMaterials(line)}
            </div>,
          );
        }
      }
      if (currentTier.nonCombatBenefitDescription) {
        nodes.push(
          <div key={`b-${nodes.length}`} className="text-balance">
            {renderTextWithMaterials(currentTier.nonCombatBenefitDescription)}
          </div>,
        );
      }
    }

    return ({ visible, triggerRef }) => (
      <DetailPopup
        idPrefix={item.data.id}
        title={
          <span className="inline-flex items-center gap-2">
            {item.data.title}
            <StarRating current={currentLevel} max={maxTiers} className="h-4 w-4" />
          </span>
        }
        subtitle={undefined}
        descriptionLines={item.data.description ? [item.data.description] : []}
        descriptionNodes={nodes}
        visible={visible}
        triggerRef={triggerRef}
      />
    );
  }, [item, displayTierIndex, currentLevel, maxTiers]);
}
