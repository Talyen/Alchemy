import { type ReactNode, type RefObject } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { PlasmaColorPair } from "@/lib/animation/plasma-colors";

import { cardInteractiveGlowClass } from "../config";
import { Surface } from "./surface";
import { useInteractiveCard } from "./use-interactive-card";
import { useHoverVisible } from "./use-hover-visible";
import { usePlasmaInteraction } from "./use-plasma-source";

interface ChooserArtTileProps {
  interactionKey: string;
  interactionId: string;
  art: string;
  icon: LucideIcon;
  label: string;

  ariaLabel?: string | undefined;
  accentClassName: string;
  widthClass: string;
  paddedTileClass?: string | undefined;
  disabled?: boolean;
  surfaceClassName?: string | undefined;
  overlay?: ReactNode | undefined;
  onClick: () => void;

  tooltipTriggerRef?: RefObject<HTMLButtonElement | null> | undefined;
  renderTooltip?: ((visible: boolean) => ReactNode) | undefined;
  plasmaColorPair?: PlasmaColorPair | null | undefined;
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
  disabled = false,
  surfaceClassName,
  overlay,
  onClick,
  tooltipTriggerRef,
  renderTooltip,
  plasmaColorPair = null,
}: ChooserArtTileProps) {
  const { onHoverStart, onHoverEnd, shimmerActive, shimmerToken } = useInteractiveCard(interactionKey, interactionId);
  const hover = useHoverVisible({ onHoverStart, onHoverEnd });
  const tooltipVisible = hover.visible;
  const trackTooltip = renderTooltip !== undefined;
  usePlasmaInteraction(plasmaColorPair, tooltipVisible && !disabled);

  return (
    <div className={cn("group flex flex-col items-center gap-5", paddedTileClass)}>
      <Surface
        as="button"
        buttonRef={tooltipTriggerRef}
        ariaLabel={ariaLabel ?? label}
        {...(disabled ? { ariaDisabled: true } : {})}
        onClick={onClick}
        onMouseEnter={hover.onMouseEnter}
        onMouseLeave={hover.onMouseLeave}
        onFocus={hover.onFocusCapture}
        onBlur={hover.onBlurCapture}
        shimmerActive={disabled ? false : shimmerActive}
        shimmerToken={disabled ? undefined : shimmerToken}
        shimmerRounded="rounded-shell-card"
        overlay={overlay}
        className={cn(
          "group card-art-frame relative mx-auto block aspect-[4/3] w-full cursor-pointer overflow-hidden rounded-shell-card border border-border/80 bg-black shadow-md focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary",
          widthClass,
          !disabled && cardInteractiveGlowClass,
          surfaceClassName,
        )}
      >
        <img
          src={art}
          alt=""
          decoding="async"
          className="pointer-events-none block h-full w-full object-cover select-none"
          draggable={false}
        />
      </Surface>
      {trackTooltip ? renderTooltip(tooltipVisible) : null}
      <div className="pointer-events-none flex items-center justify-center gap-2.5 pt-1 text-center font-sans text-lg font-bold tracking-wide select-none sm:text-xl">
        <Icon className={cn("shrink-0", accentClassName)} />
        <span className={accentClassName}>{label}</span>
      </div>
    </div>
  );
}
