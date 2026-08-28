import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { cardInteractiveGlowClass } from "../../../shared/config";
import { TiltSurface } from "../../../shared/ui/tilt-surface";
import { type PopupContext } from "../../../shared/ui/interactive-art-tile";

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
          className={cn("group relative w-full rounded-shell-card p-4", wrapperClassName)}
          onMouseEnter={() => setHoveredItemId(id)}
          onMouseLeave={() => setHoveredItemId(null)}
        >
          <TiltSurface
            className={cn(
              "group relative mx-auto flex items-center justify-center overflow-hidden rounded-shell-card border border-border/80 bg-stone-900 shadow-md",
              cardInteractiveGlowClass,
              surfaceClassName,
            )}
          >
            <img src={imageSrc} alt={imageAlt} className={imageClassName} />
          </TiltSurface>
        </div>
        {footer}
      </div>
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
