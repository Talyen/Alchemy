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
}: {
  label: string;
  cost: MaterialInventory;
  inventory: MaterialInventory;
}) {
  const costItems = MATERIAL_IDS.filter((m) => (cost[m] ?? 0) > 0);
  if (costItems.length === 0) return null;
  return (
    <>
      <TooltipSeparator />
      <TooltipSection label={label}>
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
      </TooltipSection>
    </>
  );
}
