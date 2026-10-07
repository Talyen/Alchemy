import { TOOLTIP_FADE_MS } from "@/lib/game-constants";
import { type RefObject, type ReactNode } from "react";

import { ShineBorder } from "@/components/ui/shine-border";
import { cn } from "@/lib/cn";

import { cardInteractiveGlowClass, cardShineFrameClass } from "../config";
import { Surface } from "./surface";
import { useInteractiveCard } from "./use-interactive-card";
import { useHoverVisible } from "./use-hover-visible";

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
  as?: "button" | "div" | undefined;
  interactive?: boolean | undefined;
  selected?: boolean | undefined;

  interactiveChrome?: boolean | undefined;
  shineOnHover?: boolean | undefined;
  shineColor?: string | readonly string[] | undefined;
  disabled?: boolean | undefined;
  showGlow?: boolean | undefined;
  ariaDisabled?: boolean | undefined;
  onClick?: (() => void) | undefined;
  ariaLabel?: string | undefined;
  children?: ReactNode | undefined;

  onHoverChange?: ((hovered: boolean) => void) | undefined;
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
  interactiveChrome = true,
  shineColor,
  shineOnHover = false,
  disabled = false,
  showGlow: showGlowOverride,
  ariaDisabled,
  onClick,
  ariaLabel,
  children,
  onHoverChange,
}: InteractiveArtTileProps) {
  const { isHovered, onHoverStart, onHoverEnd, shimmerActive, shimmerToken } = useInteractiveCard(interactionKey, id);
  const wrappedHoverStart = onHoverChange
    ? () => {
        onHoverStart();
        onHoverChange(true);
      }
    : onHoverStart;
  const wrappedHoverEnd = onHoverChange
    ? () => {
        onHoverEnd();
        onHoverChange(false);
      }
    : onHoverEnd;
  const { wrapperRef, showPopup, handleHoverStart, handleMouseLeave, handleBlur } = useHoverVisible({
    holdMs: TOOLTIP_FADE_MS,
    focusWithinGuard: true,
    interactive,
    isHovered,
    onHoverStart: wrappedHoverStart,
    onHoverEnd: wrappedHoverEnd,
  });

  const unavailable = disabled || ariaDisabled === true;
  const canInteract = interactive && !unavailable;
  const shineColors: string | readonly string[] =
    shineColor == null ? [] : Array.isArray(shineColor) ? shineColor : [shineColor];
  const showShine = shineColors.length > 0 && !unavailable && (!shineOnHover || (interactive && isHovered));
  const showGlow = showGlowOverride ?? (interactiveChrome && canInteract);
  const shineClassName = showShine ? (shineOnHover ? "card-art-shine" : cardShineFrameClass) : undefined;
  const glowClassName = showGlow ? cardInteractiveGlowClass : undefined;
  const frameClassName = interactiveChrome ? "card-art-frame border border-border/80" : undefined;

  return (
    <div
      ref={wrapperRef}
      className="relative"
      onMouseEnter={interactive ? handleHoverStart : undefined}
      onMouseLeave={interactive ? handleMouseLeave : undefined}
    >
      {/* eslint-disable-next-line react-hooks/refs -- popup trigger uses mutable ref provided by useHoverVisible */}
      {interactive && popup && showPopup ? popup({ visible: isHovered, triggerRef: wrapperRef }) : null}
      <Surface
        as={as}
        className={cn(
          className,
          "group shadow-md",
          ariaDisabled && "cursor-default grayscale",
          shineClassName,
          frameClassName,
          glowClassName,
        )}
        shimmerActive={canInteract && shimmerActive}
        shimmerToken={canInteract ? shimmerToken : undefined}
        overlay={showShine ? <ShineBorder shineColor={shineColors} borderWidth={2} className="z-20" /> : null}
        selected={interactiveChrome && selected}
        disabled={disabled}
        // Unavailable tiles may supply an explicit rejection handler; visual chrome
        // must not suppress that feedback. Purchase callers omit their action.
        onClick={interactive && !disabled ? onClick : undefined}
        {...(interactive ? { onFocus: handleHoverStart, onBlur: handleBlur } : {})}
        ariaLabel={ariaLabel ?? title}
        {...(ariaDisabled !== undefined ? { ariaDisabled } : {})}
      >
        {art ? <img src={art} alt={title} className={imageClassName} /> : null}
        {children}
      </Surface>
    </div>
  );
}
