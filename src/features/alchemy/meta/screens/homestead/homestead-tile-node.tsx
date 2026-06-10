// Shared homestead tile layout: hover shell, tilt surface, and footer slot.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TiltSurface } from "../../../shared/ui/tilt-surface";
import { HOMESTEAD_CONFIG } from "./helpers";

export function HomesteadTileFrame({
  id,
  index,
  hoveredItemId,
  setHoveredItemId,
  detailTooltip,
  surfaceClassName,
  imageSrc,
  imageAlt,
  imageClassName,
  footer,
}: {
  id: string;
  index: number;
  hoveredItemId: string | null;
  setHoveredItemId: (id: string | null) => void;
  detailTooltip: ReactNode;
  surfaceClassName: string;
  imageSrc: string;
  imageAlt: string;
  imageClassName: string;
  footer: ReactNode;
}) {
  return (
    <div
      className={cn("relative flex flex-col items-center", index < HOMESTEAD_CONFIG.compilationFillerCount && "mb-2")}
      onMouseEnter={() => setHoveredItemId(id)}
      onMouseLeave={() => setHoveredItemId(null)}
    >
      {hoveredItemId === id ? detailTooltip : null}
      <div className="group w-full overflow-hidden rounded-shell-card p-3">
        <TiltSurface
          className={cn(
            "relative mx-auto flex items-center justify-center overflow-hidden rounded-shell-card bg-stone-900",
            surfaceClassName,
          )}
        >
          <img src={imageSrc} alt={imageAlt} className={imageClassName} />
        </TiltSurface>
      </div>
      {footer}
    </div>
  );
}

export function HomesteadTileCompletedFooter({ label, stars }: { label: string; stars: ReactNode }) {
  return (
    <div className="mt-1.5 flex h-9 items-center justify-center gap-1.5 text-sm font-semibold text-amber-100/75">
      <span>{label}</span>
      {stars}
    </div>
  );
}
