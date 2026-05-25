// Tilt-surface wrapper with shimmer overlay, selection ring, and focus ring support.
// Handles tilt mechanics (mouseMove/mouseLeave → setTiltFromEvent/clearTiltFromEvent)
// and the common card-surface decoration shared across card, trinket, character, and homestead tiles.
import { type CSSProperties, type MouseEvent, type PointerEvent, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import { staticCardTransform } from "../config/layout";
import { clearTiltFromEvent, DEFAULT_TILT_STRENGTH, setTiltFromEvent } from "../utils";
import { ShimmerOverlay } from "./shimmer";

type TiltSurfaceProps = {
  as?: "button" | "div";
  children?: ReactNode;
  className?: string;
  shimmerActive?: boolean;
  shimmerToken?: number | undefined;
  shimmerRounded?: string;
  selected?: boolean;
  disabled?: boolean;
  dragging?: boolean;
  baseTransform?: string | undefined;
  style?: CSSProperties;
  onClick?: ((e: MouseEvent<HTMLButtonElement>) => void) | undefined;
  onPointerDown?: ((e: PointerEvent<HTMLButtonElement>) => void) | undefined;
  onFocus?: () => void;
  onBlur?: () => void;
  ariaLabel?: string;
  buttonRef?: ((node: HTMLButtonElement | null) => void) | undefined;
  onMouseEnter?: (e: MouseEvent<HTMLElement>) => void;
  onMouseLeave?: (e: MouseEvent<HTMLElement>) => void;
};

export function TiltSurface({
  as: Component = "div",
  children,
  className,
  shimmerActive,
  shimmerToken,
  shimmerRounded,
  selected,
  disabled,
  dragging,
  baseTransform,
  style,
  onClick,
  onPointerDown,
  onFocus,
  onBlur,
  ariaLabel,
  buttonRef,
  onMouseEnter,
  onMouseLeave,
}: TiltSurfaceProps) {
  const isButton = Component === "button";

  if (isButton) {
    return (
      <button
        ref={buttonRef}
        type="button"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={onClick}
        onPointerDown={onPointerDown}
        onFocus={onFocus}
        onBlur={onBlur}
        onMouseMove={setTiltFromEvent}
        onMouseEnter={onMouseEnter}
        onMouseLeave={(e) => {
          clearTiltFromEvent(e);
          onMouseLeave?.(e);
        }}
        data-tilt-strength={String(DEFAULT_TILT_STRENGTH)}
        className={cn(
          "tilt-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          selected && "ring-2 ring-primary ring-offset-4 ring-offset-background",
          disabled && "cursor-default grayscale",
          dragging && "opacity-0",
          className,
        )}
        style={{ "--card-base-transform": baseTransform ?? staticCardTransform, ...style } as CSSProperties}
      >
        {shimmerActive !== undefined ? (
          <ShimmerOverlay active={shimmerActive} token={shimmerToken} rounded={shimmerRounded ?? "rounded-[30px]"} />
        ) : null}
        {children}
      </button>
    );
  }

  return (
    <div
      onMouseMove={setTiltFromEvent}
      onMouseEnter={onMouseEnter}
      onMouseLeave={(e) => {
        clearTiltFromEvent(e);
        onMouseLeave?.(e);
      }}
      data-tilt-strength={String(DEFAULT_TILT_STRENGTH)}
      className={cn(
        "tilt-surface",
        selected && "ring-2 ring-primary ring-offset-4 ring-offset-background",
        dragging && "opacity-0",
        className,
      )}
      style={{ "--card-base-transform": baseTransform ?? staticCardTransform, ...style } as CSSProperties}
    >
      {shimmerActive !== undefined ? (
        <ShimmerOverlay active={shimmerActive} token={shimmerToken} rounded={shimmerRounded ?? "rounded-[30px]"} />
      ) : null}
      {children}
    </div>
  );
}
