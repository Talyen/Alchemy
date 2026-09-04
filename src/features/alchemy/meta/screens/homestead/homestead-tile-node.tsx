import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { cardInteractiveGlowClass } from "../../../shared/config";
import { Surface } from "../../../shared/ui/surface";
import { type PopupContext } from "../../../shared/ui/interactive-art-tile";
import { MATERIAL_IDS, type MaterialInventory } from "@/lib/homestead/types";
import { Button } from "@/components/ui/button";
import { DisabledTooltip } from "../../../shared/ui/shared-ui";
import { MaterialCost } from "../../../shared/ui/material-icons";

export function HomesteadTileFrame({
  id,
  hoveredItemId,
  setHoveredItemId,
  detailTooltip,
  surfaceClassName,
  imageSrc,
  imageAlt,
  imageClassName,
  footer,
  wrapperClassName,
}: {
  id: string;
  hoveredItemId: string | null;
  setHoveredItemId: (id: string | null) => void;
  detailTooltip: (ctx: PopupContext) => ReactNode;
  surfaceClassName: string;
  imageSrc: string;
  imageAlt: string;
  imageClassName: string;
  footer: ReactNode;
  wrapperClassName?: string;
}) {
  const frameRef = useRef<HTMLDivElement>(null);

  return (
    <div>
      <div className="relative flex flex-col items-center">
        {detailTooltip({ visible: hoveredItemId === id, triggerRef: frameRef })}
        <div
          ref={frameRef}
          className={cn("group relative w-full rounded-shell-card p-4 focus:outline-none", wrapperClassName)}
          onMouseEnter={() => setHoveredItemId(id)}
          onMouseLeave={() => setHoveredItemId(null)}
          onFocus={() => setHoveredItemId(id)}
          onBlur={() => setHoveredItemId(null)}
        >
          <Surface
            className={cn(
              "group relative mx-auto flex items-center justify-center overflow-hidden rounded-shell-card border border-border/80 bg-stone-900 shadow-md",
              cardInteractiveGlowClass,
              surfaceClassName,
            )}
          >
            {imageSrc ? <img src={imageSrc} alt={imageAlt} className={imageClassName} /> : null}
          </Surface>
        </div>
        {footer}
      </div>
    </div>
  );
}

export const homesteadTileDimClass = "opacity-60 grayscale group-hover:grayscale-0 group-focus-within:grayscale-0";
export const homesteadUndiscoveredDimClass =
  "opacity-45 grayscale group-hover:grayscale-0 group-focus-within:grayscale-0";
export const homesteadCompletedSurfaceClass = "bg-stone-800/70";

export function HomesteadAffordButton({
  title,
  cost,
  inventory,
  affordable,
  onClick,
}: {
  title: string;
  cost: MaterialInventory;
  inventory: MaterialInventory;
  affordable: boolean;
  onClick: () => void;
}) {
  const costItems = MATERIAL_IDS.filter((m) => (cost[m] ?? 0) > 0);
  return (
    <div className="mt-1.5 flex items-center gap-2">
      <DisabledTooltip show={!affordable} message="Not Enough Resources">
        <Button variant="outline" size="lg" disabled={!affordable} onClick={onClick}>
          {title}
          {costItems.map((m) => (
            <MaterialCost
              key={m}
              material={m}
              amount={cost[m] ?? 0}
              affordable={(inventory[m] ?? 0) >= (cost[m] ?? 0)}
            />
          ))}
        </Button>
      </DisabledTooltip>
    </div>
  );
}

export function HomesteadTileCompletedFooter({
  label,
  wrapperClassName,
}: {
  label: string;
  wrapperClassName?: string;
}) {
  return (
    <div
      className={cn(
        "mt-1.5 flex h-9 items-center justify-center gap-1.5 text-sm font-semibold text-amber-100/75",
        wrapperClassName,
      )}
    >
      <span>{label}</span>
    </div>
  );
}
