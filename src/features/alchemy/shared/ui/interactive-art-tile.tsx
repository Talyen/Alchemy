// Shared art tile surface for selectable rewards and purchasable collection items.
import { type RefObject, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import { TiltSurface } from "./tilt-surface";
import { useInteractiveCard } from "./use-interactive-card";
import { useTileHoverPopup } from "./use-tile-hover-popup";

export interface PopupContext {
  visible: boolean;
  triggerRef: RefObject<HTMLElement | null>;
}

interface InteractiveArtTileProps {
  id: string;
  interactionKey: string;
  title: string;
  art: string | undefined;
  className: string;
  imageClassName: string;
  popup?: (ctx: PopupContext) => ReactNode;
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
  const { wrapperRef, showPopup, handleHoverStart, handleMouseLeave, handleBlur } = useTileHoverPopup({
    interactive,
    isHovered,
    onHoverStart,
    onHoverEnd,
  });

  return (
    <div
      ref={wrapperRef}
      className="relative"
      onMouseEnter={interactive ? handleHoverStart : undefined}
      onMouseLeave={interactive ? handleMouseLeave : undefined}
    >
      {/* The ref is only read inside layout effects in PortaledTooltip's placement
          hook, never during render; passing it to the popup factory is safe. */}
      {/* eslint-disable-next-line react-hooks/refs */}
      {interactive && popup && showPopup ? popup({ visible: isHovered, triggerRef: wrapperRef }) : null}
      <TiltSurface
        as={as}
        className={cn(className, "group")}
        shimmerActive={interactive ? shimmerActive : false}
        shimmerToken={interactive ? shimmerToken : undefined}
        selected={selected}
        onClick={interactive ? onClick : undefined}
        {...(interactive ? { onFocus: handleHoverStart, onBlur: handleBlur } : {})}
        ariaLabel={ariaLabel ?? title}
      >
        <img src={art ?? undefined} alt={title} className={imageClassName} />
      </TiltSurface>
    </div>
  );
}
