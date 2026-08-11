import { useMemo, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { MATERIAL_IDS, materialLabels, type MaterialInventory } from "@/lib/homestead/types";
import { canAfford } from "@/lib/homestead/inventory";
import { Button } from "@/components/ui/button";
import { DetailPopup } from "../../../shared/ui/card-popup";
import { DisabledTooltip } from "../../../shared/ui/shared-ui";
import { type PopupContext } from "../../../shared/ui/interactive-art-tile";
import { StarRating } from "../../../shared/ui/star-rating";
import { matIconMap, matPillStyle, matTextColor } from "../../../shared/ui/material-icons";
import { HOMESTEAD_CONFIG, type GoalItem, MaterialCost, getArt, renderTextWithMaterials } from "./helpers";
import { HomesteadTileCompletedFooter, HomesteadTileFrame } from "./homestead-tile-node";

const ZERO_COST: MaterialInventory = { wood: 0, iron: 0, herbs: 0, food: 0, crystal: 0 };

export function HomesteadUpgradeNode({
  item,
  index,
  currentLevel,
  materialInventory,
  hoveredItemId,
  setHoveredItemId,
  onAction,
}: {
  item: GoalItem;
  index: number;
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
  const costItems = MATERIAL_IDS.filter((m) => (itemCost[m] ?? 0) > 0);

  const detailTooltip = useTooltipContent(item, displayTierIndex);
  const hasCost = MATERIAL_IDS.some((m) => (itemCost[m] ?? 0) > 0);

  const footer = isCompleted ? (
    <HomesteadTileCompletedFooter label={item.data.title} stars={<StarRating current={maxTiers} max={maxTiers} />} />
  ) : hasCost ? (
    <div className="mt-1.5 flex items-center gap-2">
      <DisabledTooltip show={!itemAffordable} message="Not Enough Resources">
        <Button size="lg" variant="outline" disabled={!itemAffordable} onClick={() => onAction(item)}>
          {item.data.title}
          {costItems.map((m) => (
            <MaterialCost key={m} material={m} amount={itemCost[m]} />
          ))}
        </Button>
      </DisabledTooltip>
      <StarRating current={currentLevel} max={maxTiers} />
    </div>
  ) : null;

  return (
    <HomesteadTileFrame
      id={item.data.id}
      index={index}
      hoveredItemId={hoveredItemId}
      setHoveredItemId={setHoveredItemId}
      detailTooltip={detailTooltip}
      surfaceClassName={cn(HOMESTEAD_CONFIG.artAspectRatio, "w-full", isCompleted && "bg-stone-800/70")}
      imageSrc={getArt(item.data.id)}
      imageAlt={item.data.title}
      imageClassName={cn("h-full w-full object-cover", isTier0 && "opacity-60 grayscale")}
      footer={footer}
    />
  );
}

function buildFarmYieldNodes(farm: { yield: Record<string, number> }): ReactNode[] {
  const nodes: ReactNode[] = [];
  for (const m of MATERIAL_IDS) {
    if ((farm.yield[m] ?? 0) > 0) {
      nodes.push(
        <span
          key={`yield-${m}`}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
            matPillStyle[m],
            matTextColor[m],
          )}
        >
          {matIconMap[m]} +{farm.yield[m]} {materialLabels[m]}
        </span>,
      );
    }
  }
  return nodes;
}

function useTooltipContent(item: GoalItem, displayTierIndex: number): (ctx: PopupContext) => ReactNode {
  return useMemo(() => {
    const nodes: ReactNode[] = [];
    const farm = item.kind === "farm" ? item.data : null;
    const currentTier = item.data.tiers[displayTierIndex];

    if (farm) {
      nodes.push(...buildFarmYieldNodes(farm));
    }

    if (currentTier) {
      if (currentTier.benefitDescription) {
        for (const line of currentTier.benefitDescription.split("\n")) {
          nodes.push(
            <div key={`b-${nodes.length}`} className="text-sm leading-6 text-muted-foreground">
              {renderTextWithMaterials(line)}
            </div>,
          );
        }
      }
      if (currentTier.nonCombatBenefitDescription) {
        nodes.push(
          <div key={`b-${nodes.length}`} className="text-sm leading-6 text-muted-foreground">
            {renderTextWithMaterials(currentTier.nonCombatBenefitDescription)}
          </div>,
        );
      }
    }

    return ({ visible, triggerRef }) => (
      <DetailPopup
        idPrefix={item.data.id}
        title={item.data.title}
        subtitle={undefined}
        descriptionLines={item.data.description ? [item.data.description] : []}
        descriptionNodes={nodes}
        visible={visible}
        triggerRef={triggerRef}
      />
    );
  }, [item, displayTierIndex]);
}
