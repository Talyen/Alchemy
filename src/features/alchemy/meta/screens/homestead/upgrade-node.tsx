import { useMemo, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { MATERIAL_IDS, type MaterialInventory } from "@/lib/homestead/types";
import { canAfford, emptyInventory } from "@/lib/homestead/inventory";
import { DetailPopup } from "../../../shared/ui/card-popup";
import { InteractiveArtTile, type PopupContext } from "../../../shared/ui/interactive-art-tile";
import { StarRating } from "../../../shared/ui/star-rating";
import { cardSurfaceClass, collectionGridBestiaryWidthClass, landscapeArtImageClass } from "../../../shared/config";
import { HOMESTEAD_CONFIG, type GoalItem, formatMaterialCostSummary, getArt, renderTextWithMaterials } from "./helpers";
import { HomesteadTooltipCost, homesteadCompletedSurfaceClass, homesteadTileDimClass } from "./homestead-tile-node";

const ZERO_COST: MaterialInventory = emptyInventory();

export function HomesteadUpgradeNode({
  item,
  currentLevel,
  materialInventory,
  onAction,
}: {
  item: GoalItem;
  currentLevel: number;
  materialInventory: MaterialInventory;
  onAction: (item: GoalItem) => void;
}) {
  const maxTiers = item.data.tiers.length;
  const isTier0 = currentLevel === 0;
  const isCompleted = currentLevel >= maxTiers;
  const nextTierIndex = isCompleted ? maxTiers - 1 : Math.min(currentLevel, maxTiers - 1);
  const tier = item.data.tiers[nextTierIndex];
  const itemCost = tier?.cost ?? ZERO_COST;
  const itemAffordable = !isCompleted && canAfford(materialInventory, itemCost);

  const detailTooltip = useTooltipContent(
    item,
    nextTierIndex,
    currentLevel,
    maxTiers,
    isCompleted ? null : itemCost,
    isCompleted ? null : currentLevel === 0 ? "Build" : "Upgrade",
    materialInventory,
  );

  const costSummary = formatMaterialCostSummary(itemCost);
  const ariaLabel = isCompleted
    ? `${item.data.title}, max level`
    : currentLevel === 0
      ? `Build ${item.data.title}${costSummary ? `, costs ${costSummary}` : ""}`
      : `Upgrade ${item.data.title}, level ${currentLevel} of ${maxTiers}${costSummary ? `, costs ${costSummary}` : ""}`;

  return (
    <InteractiveArtTile
      id={item.data.id}
      interactionKey={HOMESTEAD_CONFIG.hoverScope}
      title={item.data.title}
      art={getArt(item.data.id)}
      className={cn(cardSurfaceClass, collectionGridBestiaryWidthClass, isCompleted && homesteadCompletedSurfaceClass)}
      imageClassName={cn(
        "block w-full transition duration-300",
        landscapeArtImageClass,
        isTier0 && homesteadTileDimClass,
      )}
      popup={detailTooltip}
      as={isCompleted ? "div" : "button"}
      showGlow={itemAffordable}
      {...(isCompleted ? {} : { ariaDisabled: !itemAffordable })}
      onClick={itemAffordable ? () => onAction(item) : undefined}
      ariaLabel={ariaLabel}
    />
  );
}

function useTooltipContent(
  item: GoalItem,
  nextTierIndex: number,
  currentLevel: number,
  maxTiers: number,
  cost: MaterialInventory | null,
  costLabel: string | null,
  materialInventory: MaterialInventory,
): (ctx: PopupContext) => ReactNode {
  return useMemo(() => {
    const nodes: ReactNode[] = [];
    const currentTier = item.data.tiers[nextTierIndex];

    if (currentTier) {
      if (currentTier.benefitDescription) {
        for (const line of currentTier.benefitDescription.split("\n")) {
          nodes.push(<div key={`b-${nodes.length}`}>{renderTextWithMaterials(line)}</div>);
        }
      }
      if (currentTier.nonCombatBenefitDescription) {
        nodes.push(
          <div key={`b-${nodes.length}`}>{renderTextWithMaterials(currentTier.nonCombatBenefitDescription)}</div>,
        );
      }
    }

    if (cost && costLabel && MATERIAL_IDS.some((m) => (cost[m] ?? 0) > 0)) {
      nodes.push(
        <HomesteadTooltipCost
          key={`cost-${nodes.length}`}
          label={costLabel}
          cost={cost}
          inventory={materialInventory}
        />,
      );
    }

    return ({ visible, triggerRef }) => (
      <DetailPopup
        idPrefix={item.data.id}
        title={
          <span className="inline-flex items-center gap-2">
            {item.data.title}
            <StarRating current={currentLevel} max={maxTiers} className="h-3.5 w-3.5" />
          </span>
        }
        subtitle={undefined}
        descriptionLines={item.data.description ? [item.data.description] : []}
        descriptionNodes={nodes}
        visible={visible}
        triggerRef={triggerRef}
      />
    );
  }, [item, nextTierIndex, currentLevel, maxTiers, cost, costLabel, materialInventory]);
}
