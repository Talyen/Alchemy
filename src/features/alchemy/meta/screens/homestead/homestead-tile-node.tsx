import { type ReactNode } from "react";
import { MATERIAL_IDS, type MaterialInventory } from "@/lib/homestead/types";
import { MaterialCost } from "../../../shared/ui/material-icons";
import { TooltipSection, TooltipSeparator } from "../../../shared/ui/tooltip-panel";

export const homesteadTileDimClass =
  "opacity-60 grayscale group-hover:grayscale-0 group-hover:opacity-100 group-focus-within:grayscale-0 group-focus-within:opacity-100";
export const homesteadUndiscoveredDimClass =
  "opacity-45 grayscale group-hover:grayscale-0 group-hover:opacity-100 group-focus-within:grayscale-0 group-focus-within:opacity-100";
export const homesteadCompletedSurfaceClass = "bg-stone-800/70";

export function HomesteadTooltipCost({
  label,
  cost,
  inventory,
  stars,
}: {
  label: string;
  cost?: MaterialInventory | null | undefined;
  inventory?: MaterialInventory | null | undefined;
  stars?: ReactNode;
}) {
  const costItems = cost ? MATERIAL_IDS.filter((m) => (cost[m] ?? 0) > 0) : [];
  if (costItems.length === 0 && !stars) return null;
  const sectionLabel = stars ? (
    <span className="inline-flex items-center gap-2">
      <span>{label}</span>
      {stars}
    </span>
  ) : (
    label
  );
  return (
    <>
      <TooltipSeparator />
      <TooltipSection label={sectionLabel}>
        {cost && inventory && costItems.length > 0 ? (
          <div className="flex flex-wrap items-center">
            {costItems.map((m) => (
              <MaterialCost
                key={m}
                material={m}
                amount={cost[m] ?? 0}
                affordable={(inventory[m] ?? 0) >= (cost[m] ?? 0)}
              />
            ))}
          </div>
        ) : null}
      </TooltipSection>
    </>
  );
}
