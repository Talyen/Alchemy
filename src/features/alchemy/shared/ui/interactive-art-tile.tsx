import { type RefObject, type ReactNode } from "react";

import { ShineBorder } from "@/components/ui/shine-border";
import { cn } from "@/lib/utils";

import { cardInteractiveGlowClass, cardShineFrameClass } from "../config";
import { Surface } from "./surface";
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
  as?: "button" | "div" | undefined;
  interactive?: boolean | undefined;
  selected?: boolean | undefined;

  interactiveChrome?: boolean | undefined;
  shineColor?: string | readonly string[] | undefined;
  disabled?: boolean | undefined;
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
  disabled = false,
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
  const { wrapperRef, showPopup, handleHoverStart, handleMouseLeave, handleBlur } = useTileHoverPopup({
    interactive,
    isHovered,
    onHoverStart: wrappedHoverStart,
    onHoverEnd: wrappedHoverEnd,
  });
  const shineColors = shineColor == null ? [] : Array.isArray(shineColor) ? shineColor : [shineColor];

  const showShine = shineColors.length > 0 && !disabled;
  const showGlow = interactiveChrome && interactive && !disabled;

  return (
    <div
      ref={wrapperRef}
      className="relative"
      onMouseEnter={interactive ? handleHoverStart : undefined}
      onMouseLeave={interactive ? handleMouseLeave : undefined}
    >
      {}
      {/* eslint-disable-next-line react-hooks/refs -- popup trigger uses mutable ref provided by useTileHoverPopup */}
      {interactive && popup && showPopup ? popup({ visible: isHovered, triggerRef: wrapperRef }) : null}
      <Surface
        as={as}
        className={cn(
          className,
          "group shadow-md",
          showShine && cardShineFrameClass,
          !showShine && interactiveChrome && "border border-border/80",
          showGlow && cardInteractiveGlowClass,
        )}
        shimmerActive={interactive && !disabled ? shimmerActive : false}
        shimmerToken={interactive && !disabled ? shimmerToken : undefined}
        selected={interactiveChrome && selected}
        disabled={disabled}
        onClick={interactive && !disabled ? onClick : undefined}
        {...(interactive ? { onFocus: handleHoverStart, onBlur: handleBlur } : {})}
        ariaLabel={ariaLabel ?? title}
      >
        <img src={art ?? undefined} alt={title} className={imageClassName} />
        {showShine ? <ShineBorder shineColor={shineColors} borderWidth={2} className="z-20" /> : null}
        {children}
      </Surface>
    </div>
  );
}
