// Shared homestead tile layout: hover shell, tilt surface, and footer slot.
import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { StaggerItem } from "../../../shared/ui/shared-ui";
import { TiltSurface } from "../../../shared/ui/tilt-surface";
import { type PopupContext } from "../../../shared/ui/interactive-art-tile";
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
  wrapperClassName,
}: {
  id: string;
  index: number;
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
    <div
      ref={frameRef}
      className="relative"
      onMouseEnter={() => setHoveredItemId(id)}
      onMouseLeave={() => setHoveredItemId(null)}
    >
      <StaggerItem
        index={index}
        className={cn("relative flex flex-col items-center", index < HOMESTEAD_CONFIG.compilationFillerCount && "mb-2")}
      >
        {detailTooltip({ visible: hoveredItemId === id, triggerRef: frameRef })}
        <div className={cn("group w-full overflow-hidden rounded-shell-card p-3", wrapperClassName)}>
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
      </StaggerItem>
    </div>
  );
}

export function HomesteadTileCompletedFooter({
  label,
  stars,
  wrapperClassName,
}: {
  label: string;
  stars: ReactNode;
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
      {stars}
    </div>
  );
}
