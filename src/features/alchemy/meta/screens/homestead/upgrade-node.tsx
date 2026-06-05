import { useMemo, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { MATERIAL_IDS, materialLabels, type HomesteadFarm, type MaterialInventory } from "@/lib/homestead/types";
import { canAfford } from "@/lib/homestead/inventory";
import { Button } from "@/components/ui/button";
import { DetailPopup } from "../../../shared/ui/card-popup";
import { DisabledTooltip } from "../../../shared/ui/shared-ui";
import { StarRating } from "../../../shared/ui/star-rating";
import { TiltSurface } from "../../../shared/ui/tilt-surface";
import { matIconMap, matPillStyle, matTextColor } from "../../../shared/ui/material-icons";
import { HOMESTEAD_CONFIG, type GoalItem, MaterialCost, getArt, renderTextWithMaterials } from "./helpers";

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
  const itemCost = item.data.tiers[isCompleted ? maxTiers - 1 : Math.min(currentLevel, maxTiers - 1)].cost;
  const itemAffordable = !isCompleted && canAfford(materialInventory, itemCost);
  const costItems = MATERIAL_IDS.filter((m) => (itemCost[m] ?? 0) > 0);

  const detailTooltip = useMemo(() => {
    if (hoveredItemId !== item.data.id) return null;
    const nodes: ReactNode[] = [];
    const farm = item.kind === "farm" ? (item.data as HomesteadFarm) : null;
    const currentTier = item.data.tiers[displayTierIndex];

    if (farm) {
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

    return (
      <DetailPopup
        idPrefix={item.data.id}
        title={item.data.title}
        subtitle={undefined}
        descriptionLines={item.data.description ? [item.data.description] : []}
        descriptionNodes={nodes}
      />
    );
  }, [hoveredItemId, item, displayTierIndex]);

  const hasCost = MATERIAL_IDS.some((m) => (itemCost[m] ?? 0) > 0);

  return (
    <div
      className={cn("flex flex-col items-center relative", index < HOMESTEAD_CONFIG.compilationFillerCount && "mb-2")}
      onMouseEnter={() => setHoveredItemId(item.data.id)}
      onMouseLeave={() => setHoveredItemId(null)}
    >
      {detailTooltip}
      <div className="group w-full overflow-hidden rounded-shell-card p-3">
        <TiltSurface
          className={cn(
            "relative mx-auto flex w-full items-center justify-center overflow-hidden rounded-shell-card bg-stone-900",
            HOMESTEAD_CONFIG.artAspectRatio,
            isCompleted && "bg-stone-800/70",
          )}
        >
          <img
            src={getArt(item.data.id)}
            alt={item.data.title}
            className={cn("h-full w-full object-cover", isTier0 && "grayscale opacity-60")}
          />
        </TiltSurface>
      </div>

      {isCompleted ? (
        <div className="mt-1.5 flex h-9 items-center justify-center gap-1.5 text-sm font-semibold text-amber-100/75">
          <span>{item.data.title}</span>
          <StarRating current={maxTiers} max={maxTiers} />
        </div>
      ) : hasCost ? (
        <div className="mt-1.5 flex items-center gap-2">
          <DisabledTooltip show={!itemAffordable} message="Not Enough Resources">
            <Button variant="outline" disabled={!itemAffordable} onClick={() => onAction(item)}>
              {item.data.title}
              {costItems.map((m) => (
                <MaterialCost key={m} material={m} amount={itemCost[m]} />
              ))}
            </Button>
          </DisabledTooltip>
          <StarRating current={currentLevel} max={maxTiers} />
        </div>
      ) : null}
    </div>
  );
}
