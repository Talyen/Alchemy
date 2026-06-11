// Tilt-surface wrapper with shimmer overlay, selection ring, and focus ring support.
// Handles tilt mechanics (mouseMove/mouseLeave → setTiltFromEvent/clearTiltFromEvent)
// and the common card-surface decoration shared across card, trinket, character, and homestead tiles.
import {
  useEffect,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type Ref,
} from "react";

import { cn } from "@/lib/utils";

import { staticCardTransform } from "../config/layout";
import { clearTiltElement, clearTiltFromEvent, DEFAULT_TILT_STRENGTH, setTiltFromEvent } from "../utils";
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
  tiltEnabled?: boolean;
  tiltStrength?: number;
  baseTransform?: string | undefined;
  style?: CSSProperties;
  onClick?: ((e: MouseEvent<HTMLButtonElement>) => void) | undefined;
  onDivClick?: ((e: MouseEvent<HTMLDivElement>) => void) | undefined;
  onPointerDown?: ((e: PointerEvent<HTMLButtonElement>) => void) | undefined;
  onFocus?: () => void;
  onBlur?: () => void;
  ariaLabel?: string;
  ariaPressed?: boolean;
  buttonRef?: Ref<HTMLButtonElement> | undefined;
  surfaceRef?: Ref<HTMLDivElement> | undefined;
  testId?: string;
  dataCount?: number;
  onMouseEnter?: (e: MouseEvent<HTMLElement>) => void;
  onMouseLeave?: (e: MouseEvent<HTMLElement>) => void;
};

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (!ref) return;
  if (typeof ref === "function") {
    ref(value);
    return;
  }
  ref.current = value;
}

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
  tiltEnabled = true,
  tiltStrength = DEFAULT_TILT_STRENGTH,
  baseTransform,
  style,
  onClick,
  onDivClick,
  onPointerDown,
  onFocus,
  onBlur,
  ariaLabel,
  ariaPressed,
  buttonRef,
  surfaceRef,
  testId,
  dataCount,
  onMouseEnter,
  onMouseLeave,
}: TiltSurfaceProps) {
  const isButton = Component === "button";
  const canTilt = tiltEnabled && !(isButton && disabled);
  const surfaceElementRef = useRef<HTMLDivElement | null>(null);
  const buttonElementRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (canTilt) return;
    if (surfaceElementRef.current) clearTiltElement(surfaceElementRef.current);
    if (buttonElementRef.current) clearTiltElement(buttonElementRef.current);
  }, [canTilt]);

  const handleMouseMove = canTilt ? setTiltFromEvent : undefined;
  const handleMouseLeave = (e: MouseEvent<HTMLElement>) => {
    if (canTilt) clearTiltFromEvent(e);
    onMouseLeave?.(e);
  };

  const handleDivKeyDown = onDivClick
    ? (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onDivClick(e as unknown as MouseEvent<HTMLDivElement>);
        }
      }
    : undefined;

  const surfaceStyle = { "--card-base-transform": baseTransform ?? staticCardTransform, ...style } as CSSProperties;

  if (isButton) {
    return (
      <button
        ref={(element) => {
          buttonElementRef.current = element;
          assignRef(buttonRef, element);
        }}
        type="button"
        aria-label={ariaLabel}
        {...(ariaPressed !== undefined ? { "aria-pressed": ariaPressed } : {})}
        disabled={disabled}
        onClick={onClick}
        onPointerDown={onPointerDown}
        onFocus={onFocus}
        onBlur={onBlur}
        onMouseMove={handleMouseMove}
        onMouseEnter={onMouseEnter}
        onMouseLeave={handleMouseLeave}
        data-testid={testId}
        data-tilt-strength={String(tiltStrength)}
        className={cn(
          "tilt-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          selected && "ring-2 ring-primary ring-offset-4 ring-offset-background",
          disabled && "cursor-default grayscale",
          dragging && "opacity-0",
          className,
        )}
        style={surfaceStyle}
      >
        {shimmerActive !== undefined ? (
          <ShimmerOverlay
            active={shimmerActive}
            token={shimmerToken}
            rounded={shimmerRounded ?? "rounded-shell-hero"}
          />
        ) : null}
        {children}
      </button>
    );
  }

  return (
    <div
      ref={(element) => {
        surfaceElementRef.current = element;
        assignRef(surfaceRef, element);
      }}
      data-testid={testId}
      {...(dataCount !== undefined ? { "data-count": dataCount } : {})}
      onClick={onDivClick}
      onKeyDown={handleDivKeyDown}
      role={onDivClick ? "button" : undefined}
      tabIndex={onDivClick ? 0 : undefined}
      aria-label={onDivClick ? ariaLabel : undefined}
      onMouseMove={handleMouseMove}
      onMouseEnter={onMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-tilt-strength={String(tiltStrength)}
      className={cn(
        "tilt-surface",
        selected && "ring-2 ring-primary ring-offset-4 ring-offset-background",
        dragging && "opacity-0",
        className,
      )}
      style={surfaceStyle}
    >
      {shimmerActive !== undefined ? (
        <ShimmerOverlay active={shimmerActive} token={shimmerToken} rounded={shimmerRounded ?? "rounded-shell-hero"} />
      ) : null}
      {children}
    </div>
  );
}
