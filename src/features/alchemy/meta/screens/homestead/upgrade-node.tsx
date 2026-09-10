import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { type MaterialInventory } from "@/lib/homestead/types";
import { canAfford, emptyInventory } from "@/lib/homestead/inventory";
import { DetailPopup } from "../../../shared/ui/card-popup";
import { InteractiveArtTile, type PopupContext } from "../../../shared/ui/interactive-art-tile";
import { StarRating } from "../../../shared/ui/star-rating";
import {
  cardSurfaceClass,
  collectionGridBestiaryWidthClass,
  getInspectionKeywordShineColors,
  landscapeArtImageClass,
} from "../../../shared/config";
import { HOMESTEAD_CONFIG, type GoalItem, formatMaterialCostSummary, getArt, renderTextWithMaterials } from "./helpers";
import { HomesteadTooltipCost, homesteadCompletedSurfaceClass, homesteadTileDimClass } from "./homestead-tile-node";
import { extractKeywordIds } from "@/lib/keyword-text";

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

  const detailTooltip = getUpgradeTooltip(
    item,
    nextTierIndex,
    currentLevel,
    maxTiers,
    isCompleted ? null : itemCost,
    isCompleted ? "Max Level" : currentLevel === 0 ? "Build" : "Upgrade",
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
      showGlow
      shineOnHover
      shineColor={getHomesteadUpgradeShineColors(item)}
      {...(isCompleted ? {} : { ariaDisabled: !itemAffordable })}
      onClick={itemAffordable ? () => onAction(item) : undefined}
      ariaLabel={ariaLabel}
    />
  );
}

function getHomesteadUpgradeShineColors(item: GoalItem): readonly string[] {
  const text = item.data.tiers
    .flatMap((tier) => [tier.benefitDescription, tier.nonCombatBenefitDescription ?? ""])
    .join("\n");
  return getInspectionKeywordShineColors(extractKeywordIds(text));
}

function getUpgradeTooltip(
  item: GoalItem,
  nextTierIndex: number,
  currentLevel: number,
  maxTiers: number,
  cost: MaterialInventory | null,
  costLabel: string,
  materialInventory: MaterialInventory,
): (ctx: PopupContext) => ReactNode {
  return ({ visible, triggerRef }) => {
    const nodes: ReactNode[] = [];
    if (visible) {
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

      nodes.push(
        <HomesteadTooltipCost
          key={`cost-${nodes.length}`}
          label={costLabel}
          cost={cost}
          inventory={materialInventory}
          stars={<StarRating current={currentLevel} max={maxTiers} />}
        />,
      );
    }

    return (
      <DetailPopup
        idPrefix={item.data.id}
        title={item.data.title}
        subtitle={undefined}
        descriptionLines={[]}
        descriptionNodes={nodes}
        visible={visible}
        triggerRef={triggerRef}
      />
    );
  };
}
