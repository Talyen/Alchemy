import { TOOLTIP_FADE_MS } from "@/lib/game-constants";
import { type RefObject, type ReactNode } from "react";

import { ShineBorder } from "@/components/ui/shine-border";
import { cn } from "@/lib/utils";

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

interface TileVisualResolutionProps {
  interactive: boolean;
  disabled: boolean;
  interactiveChrome: boolean;
  selected: boolean;
  isHovered: boolean;
  shineColor: string | readonly string[] | null | undefined;
  shineOnHover: boolean;
  showGlowOverride?: boolean | undefined;
  shimmerActive: boolean;
  shimmerToken?: number | undefined;
}

function resolveArtTileVisualState(props: TileVisualResolutionProps) {
  const canInteract = props.interactive && !props.disabled;
  const shineColors: string | readonly string[] =
    props.shineColor == null ? [] : Array.isArray(props.shineColor) ? props.shineColor : [props.shineColor];
  const showShine =
    shineColors.length > 0 && !props.disabled && (!props.shineOnHover || (props.interactive && props.isHovered));
  const showGlow = props.showGlowOverride ?? (props.interactiveChrome && canInteract);

  const shineClassName = showShine ? (props.shineOnHover ? "card-art-shine" : cardShineFrameClass) : undefined;
  const glowClassName = showGlow ? cardInteractiveGlowClass : undefined;
  const frameClassName = props.interactiveChrome ? "card-art-frame border border-border/80" : undefined;

  return {
    canInteract,
    shineColors,
    showShine,
    activeShimmer: canInteract && props.shimmerActive,
    activeShimmerToken: canInteract ? props.shimmerToken : undefined,
    surfaceSelected: props.interactiveChrome && props.selected,
    shineClassName,
    glowClassName,
    frameClassName,
  };
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

  const visual = resolveArtTileVisualState({
    interactive,
    disabled: disabled || ariaDisabled === true,
    interactiveChrome,
    selected,
    isHovered,
    shineColor,
    shineOnHover,
    showGlowOverride,
    shimmerActive,
    shimmerToken,
  });

  return (
    <div
      ref={wrapperRef}
      className="relative"
      onMouseEnter={interactive ? handleHoverStart : undefined}
      onMouseLeave={interactive ? handleMouseLeave : undefined}
    >
      {}
      {/* eslint-disable-next-line react-hooks/refs -- popup trigger uses mutable ref provided by useHoverVisible */}
      {interactive && popup && showPopup ? popup({ visible: isHovered, triggerRef: wrapperRef }) : null}
      <Surface
        as={as}
        className={cn(
          className,
          "group shadow-md",
          ariaDisabled && "cursor-default grayscale",
          visual.shineClassName,
          visual.frameClassName,
          visual.glowClassName,
        )}
        shimmerActive={visual.activeShimmer}
        shimmerToken={visual.activeShimmerToken}
        overlay={
          visual.showShine ? <ShineBorder shineColor={visual.shineColors} borderWidth={2} className="z-20" /> : null
        }
        selected={visual.surfaceSelected}
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
