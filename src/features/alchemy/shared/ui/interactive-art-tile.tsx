// Shared art tile surface for selectable rewards and purchasable collection items.
import { useRef, type RefObject, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import { TiltSurface } from "./tilt-surface";
import { useInteractiveCard } from "./use-interactive-card";

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
  const tileRef = useRef<HTMLDivElement>(null);
  const { isHovered, onHoverStart, onHoverEnd, shimmerActive, shimmerToken } = useInteractiveCard(interactionKey, id);

  return (
    <div
      ref={tileRef}
      className="relative"
      onMouseEnter={interactive ? onHoverStart : undefined}
      onMouseLeave={interactive ? onHoverEnd : undefined}
    >
      {/* The ref is only read inside layout effects in PortaledTooltip's placement
          hook, never during render; passing it to the popup factory is safe. */}
      {/* eslint-disable-next-line react-hooks/refs */}
      {interactive && popup ? popup({ visible: isHovered, triggerRef: tileRef }) : null}
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
