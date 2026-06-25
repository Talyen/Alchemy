// Tilt-surface wrapper with shimmer overlay and selection ring support.
// Handles tilt mechanics (mouseMove/mouseLeave → setTiltFromEvent/clearTiltFromEvent)
// and the common card-surface decoration shared across card, boon, character, and homestead tiles.
import {
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
import { clearTiltFromEvent, DEFAULT_TILT_STRENGTH, setTiltFromEvent } from "../utils";
import { ShimmerOverlay } from "./shimmer";

interface TiltSurfaceProps {
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
  onDoubleClick?: ((e: MouseEvent<HTMLButtonElement>) => void) | undefined;
  onDivClick?: ((e?: MouseEvent<HTMLDivElement>) => void) | undefined;
  onPointerDown?: ((e: PointerEvent<HTMLButtonElement>) => void) | undefined;
  onFocus?: () => void;
  onBlur?: () => void;
  ariaLabel?: string;
  ariaPressed?: boolean;
  ariaExpanded?: boolean | undefined;
  buttonRef?: Ref<HTMLButtonElement> | undefined;
  surfaceRef?: Ref<HTMLDivElement> | undefined;
  testId?: string;
  dataCount?: number;
  onMouseEnter?: (e: MouseEvent<HTMLElement>) => void;
  onMouseLeave?: (e: MouseEvent<HTMLElement>) => void;
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (!ref) return;
  if (typeof ref === "function") {
    ref(value);
    return;
  }
  ref.current = value;
}

interface ShimmerProps {
  active: boolean | undefined;
  token: number | undefined;
  rounded: string | undefined;
}
function ShimmerSlot({ active, token, rounded }: ShimmerProps) {
  return active !== undefined ? (
    <ShimmerOverlay active={active} token={token} rounded={rounded ?? "rounded-shell-hero"} />
  ) : null;
}

const TILT_CLASSES = "tilt-surface";

function useTiltHandlers(canTilt: boolean, onMouseLeave?: (e: MouseEvent<HTMLElement>) => void) {
  const handleMouseMove = canTilt ? setTiltFromEvent : undefined;
  const handleMouseLeave = (e: MouseEvent<HTMLElement>) => {
    if (canTilt) clearTiltFromEvent(e);
    onMouseLeave?.(e);
  };
  return { handleMouseMove, handleMouseLeave };
}

interface TiltSurfaceInner extends TiltSurfaceProps {
  surfaceStyle: CSSProperties;
  children: ReactNode;
}

function TiltSurfaceButton({
  children,
  className,
  shimmerActive,
  shimmerToken,
  shimmerRounded,
  selected,
  disabled,
  dragging,
  onClick,
  onDoubleClick,
  onPointerDown,
  onFocus,
  onBlur,
  ariaLabel,
  ariaPressed,
  ariaExpanded,
  buttonRef,
  testId,
  tiltStrength,
  onMouseEnter,
  onMouseLeave,
  surfaceStyle,
  tiltEnabled,
}: TiltSurfaceInner) {
  const canTilt = tiltEnabled !== false && !disabled;
  const buttonRef_ = useRef<HTMLButtonElement | null>(null);
  const { handleMouseMove, handleMouseLeave } = useTiltHandlers(canTilt, onMouseLeave);
  return (
    <button
      ref={(element) => {
        buttonRef_.current = element;
        assignRef(buttonRef, element);
      }}
      type="button"
      aria-label={ariaLabel}
      {...(ariaPressed !== undefined ? { "aria-pressed": ariaPressed } : {})}
      {...(ariaExpanded !== undefined ? { "aria-expanded": ariaExpanded } : {})}
      disabled={disabled}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onPointerDown={onPointerDown}
      onFocus={onFocus}
      onBlur={onBlur}
      onMouseMove={handleMouseMove}
      onMouseEnter={onMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-testid={testId}
      data-tilt-strength={String(tiltStrength ?? DEFAULT_TILT_STRENGTH)}
      className={cn(
        TILT_CLASSES,
        selected && "ring-2 ring-primary ring-offset-4 ring-offset-background",
        disabled && "cursor-default grayscale",
        dragging && "opacity-0",
        className,
      )}
      style={surfaceStyle}
    >
      <ShimmerSlot active={shimmerActive} token={shimmerToken} rounded={shimmerRounded} />
      {children}
    </button>
  );
}

function TiltSurfaceDiv({
  children,
  className,
  shimmerActive,
  shimmerToken,
  shimmerRounded,
  selected,
  dragging,
  onDivClick,
  ariaLabel,
  ariaExpanded,
  surfaceRef,
  testId,
  dataCount,
  tiltStrength,
  onMouseEnter,
  onMouseLeave,
  surfaceStyle,
  tiltEnabled,
}: TiltSurfaceInner) {
  const surfaceRef_ = useRef<HTMLDivElement | null>(null);
  const { handleMouseMove, handleMouseLeave } = useTiltHandlers(tiltEnabled !== false, onMouseLeave);
  const handleDivKeyDown = onDivClick
    ? (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onDivClick();
        }
      }
    : undefined;
  return (
    <div
      ref={(element) => {
        surfaceRef_.current = element;
        assignRef(surfaceRef, element);
      }}
      data-testid={testId}
      {...(dataCount !== undefined ? { "data-count": dataCount } : {})}
      onClick={onDivClick}
      onKeyDown={handleDivKeyDown}
      role={onDivClick ? "button" : undefined}
      tabIndex={onDivClick ? 0 : undefined}
      aria-label={onDivClick ? ariaLabel : undefined}
      {...(ariaExpanded !== undefined && onDivClick ? { "aria-expanded": ariaExpanded } : {})}
      onMouseMove={handleMouseMove}
      onMouseEnter={onMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-tilt-strength={String(tiltStrength ?? DEFAULT_TILT_STRENGTH)}
      className={cn(
        TILT_CLASSES,
        selected && "ring-2 ring-primary ring-offset-4 ring-offset-background",
        dragging && "opacity-0",
        className,
      )}
      style={surfaceStyle}
    >
      <ShimmerSlot active={shimmerActive} token={shimmerToken} rounded={shimmerRounded} />
      {children}
    </div>
  );
}

export function TiltSurface(props: TiltSurfaceProps) {
  const {
    as: Component = "div",
    tiltEnabled = true,
    tiltStrength = DEFAULT_TILT_STRENGTH,
    baseTransform,
    style,
    children,
    ...rest
  } = props;
  const surfaceStyle = { "--card-base-transform": baseTransform ?? staticCardTransform, ...style } as CSSProperties;
  if (Component === "button")
    return (
      <TiltSurfaceButton tiltEnabled={tiltEnabled} tiltStrength={tiltStrength} {...rest} surfaceStyle={surfaceStyle}>
        {children}
      </TiltSurfaceButton>
    );
  return (
    <TiltSurfaceDiv tiltEnabled={tiltEnabled} tiltStrength={tiltStrength} {...rest} surfaceStyle={surfaceStyle}>
      {children}
    </TiltSurfaceDiv>
  );
}
