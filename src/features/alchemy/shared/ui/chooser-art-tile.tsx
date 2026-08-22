// Shared art-chooser tile: framed art button + icon caption, with optional
// hover/focus tooltip slot. Used by destination and game-mode choosers.
import { useState, type ReactNode, type RefObject } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import { cardInteractiveGlowClass } from "../config";
import { TiltSurface } from "./tilt-surface";
import { useInteractiveCard } from "./use-interactive-card";

interface ChooserArtTileProps {
  interactionKey: string;
  interactionId: string;
  art: string;
  icon: LucideIcon;
  label: string;
  /** Screen-reader label override when the visible caption is not sufficient. */
  ariaLabel?: string | undefined;
  accentClassName: string;
  widthClass: string;
  paddedTileClass?: string | undefined;
  tiltEnabled?: boolean | undefined;
  disabled?: boolean;
  surfaceClassName?: string | undefined;
  overlay?: ReactNode | undefined;
  onClick: () => void;
  /** Attached to the art button so portal tooltips can position from it. */
  tooltipTriggerRef?: RefObject<HTMLButtonElement | null> | undefined;
  renderTooltip?: ((visible: boolean) => ReactNode) | undefined;
}

export function ChooserArtTile({
  interactionKey,
  interactionId,
  art,
  icon: Icon,
  label,
  ariaLabel,
  accentClassName,
  widthClass,
  paddedTileClass,
  tiltEnabled,
  disabled = false,
  surfaceClassName,
  overlay,
  onClick,
  tooltipTriggerRef,
  renderTooltip,
}: ChooserArtTileProps) {
  const { onHoverStart, onHoverEnd, shimmerActive, shimmerToken } = useInteractiveCard(interactionKey, interactionId);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const trackTooltip = renderTooltip !== undefined;

  return (
    <div className={cn("group flex flex-col items-center gap-5", paddedTileClass)}>
      <TiltSurface
        as="button"
        buttonRef={tooltipTriggerRef}
        tiltEnabled={tiltEnabled ?? false}
        ariaLabel={ariaLabel ?? label}
        {...(disabled ? { ariaDisabled: true } : {})}
        onClick={onClick}
        onMouseEnter={() => {
          if (trackTooltip) setTooltipVisible(true);
          onHoverStart();
        }}
        onMouseLeave={() => {
          if (trackTooltip) setTooltipVisible(false);
          onHoverEnd();
        }}
        onFocus={() => {
          if (trackTooltip) setTooltipVisible(true);
          onHoverStart();
        }}
        onBlur={() => {
          if (trackTooltip) setTooltipVisible(false);
          onHoverEnd();
        }}
        shimmerActive={disabled ? false : shimmerActive}
        shimmerToken={disabled ? undefined : shimmerToken}
        shimmerRounded="rounded-shell-card"
        overlay={overlay}
        className={cn(
          "group relative mx-auto block aspect-[4/3] w-full cursor-pointer overflow-hidden rounded-shell-card border border-border/80 bg-black shadow-md focus:outline-none",
          widthClass,
          !disabled && cardInteractiveGlowClass,
          surfaceClassName,
        )}
      >
        <img
          src={art}
          alt=""
          className="pointer-events-none block h-full w-full object-cover select-none"
          draggable={false}
        />
      </TiltSurface>
      {trackTooltip ? renderTooltip(tooltipVisible) : null}
      <div className="pointer-events-none flex items-center justify-center gap-2.5 pt-1 text-center select-none">
        <Icon className={cn("h-5 w-5 shrink-0", accentClassName)} />
        <span className={cn("font-sans text-lg font-bold tracking-wide sm:text-xl", accentClassName)}>{label}</span>
      </div>
    </div>
  );
}
