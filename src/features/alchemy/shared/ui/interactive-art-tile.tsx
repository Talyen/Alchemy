// Shared art tile surface for selectable rewards and purchasable collection items.
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { TiltSurface } from "./tilt-surface";
import { useInteractiveCard } from "./use-interactive-card";

interface InteractiveArtTileProps {
  id: string;
  interactionKey: string;
  title: string;
  art: string | undefined;
  className: string;
  imageClassName: string;
  popup?: ReactNode;
  as?: "button" | "div";
  interactive?: boolean;
  selected?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
}

export function InteractiveArtTile({
  id,
  interactionKey,
  title,
  art,
  className,
  imageClassName,
  popup,
  as = "div",
  interactive = true,
  selected = false,
  onClick,
  ariaLabel,
}: InteractiveArtTileProps) {
  const { isHovered, onHoverStart, onHoverEnd, shimmerActive, shimmerToken } = useInteractiveCard(interactionKey, id);

  return (
    <div
      className="relative"
      onMouseEnter={interactive ? onHoverStart : undefined}
      onMouseLeave={interactive ? onHoverEnd : undefined}
    >
      {interactive && isHovered ? popup : null}
      <TiltSurface
        as={as}
        className={cn(className, "group")}
        shimmerActive={interactive ? shimmerActive : false}
        shimmerToken={interactive ? shimmerToken : undefined}
        selected={selected}
        onClick={interactive ? onClick : undefined}
        {...(interactive ? { onFocus: onHoverStart, onBlur: onHoverEnd } : {})}
        ariaLabel={ariaLabel ?? title}
      >
        <img src={art ?? undefined} alt={title} className={imageClassName} />
      </TiltSurface>
    </div>
  );
}
