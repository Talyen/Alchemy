// Tilt-surface wrapper with shimmer overlay and selection ring support.
// Handles tilt mechanics (mouseMove/mouseLeave → setTiltFromEvent/clearTiltFromEvent)
// and the common card-surface decoration shared across card, boon, character, and homestead tiles.
import { type CSSProperties, type MouseEvent, type PointerEvent, type ReactNode, type Ref } from "react";

import { cn } from "@/lib/utils";

import { staticCardTransform, tiltSurfaceSelectedRingClass } from "../config/layout";
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
  baseTransform?: string | undefined;
  style?: CSSProperties;
  onClick?: ((e: MouseEvent<HTMLButtonElement>) => void) | undefined;
  onDivClick?: ((e?: MouseEvent<HTMLDivElement>) => void) | undefined;
  onPointerDown?: ((e: PointerEvent<HTMLButtonElement>) => void) | undefined;
  onFocus?: () => void;
  onBlur?: () => void;
  ariaLabel?: string;
  ariaDisabled?: boolean;
  ariaPressed?: boolean;
  buttonRef?: Ref<HTMLButtonElement> | undefined;
  surfaceRef?: Ref<HTMLDivElement> | undefined;
  testId?: string;
  dataCount?: number;
  onMouseEnter?: (e: MouseEvent<HTMLElement>) => void;
  onMouseLeave?: (e: MouseEvent<HTMLElement>) => void;
  /**
   * Clip children to the surface radius. Keep true for framed art so overflow:visible
   * glow does not square corners or cover the bottom border. False for battle portraits
   * whose hurt sparks must paint outside the frame.
   */
  clipContents?: boolean | undefined;
  /** Painted above the clip layer so frame chrome can cover the 3px glow border. */
  overlay?: ReactNode | undefined;
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
const CLIP_CONTENTS_CLASS = "tilt-surface-clip relative w-full overflow-hidden";

function surfaceClassName(
  selected: boolean | undefined,
  dragging: boolean | undefined,
  disabled: boolean | undefined,
  className: string | undefined,
) {
  return cn(
    TILT_CLASSES,
    selected && tiltSurfaceSelectedRingClass,
    dragging && "opacity-0",
    disabled && "cursor-default grayscale",
    className,
  );
}

function TiltSurfaceBody({
  clipContents,
  shimmerActive,
  shimmerToken,
  shimmerRounded,
  overlay,
  children,
}: {
  clipContents: boolean;
  shimmerActive: boolean | undefined;
  shimmerToken: number | undefined;
  shimmerRounded: string | undefined;
  overlay: ReactNode | undefined;
  children: ReactNode;
}) {
  return (
    <>
      <ShimmerSlot active={shimmerActive} token={shimmerToken} rounded={shimmerRounded} />
      {clipContents ? <div className={CLIP_CONTENTS_CLASS}>{children}</div> : children}
      {overlay}
    </>
  );
}

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
  onPointerDown,
  onFocus,
  onBlur,
  ariaLabel,
  ariaDisabled,
  ariaPressed,
  buttonRef,
  testId,
  onMouseEnter,
  onMouseLeave,
  surfaceStyle,
  tiltEnabled,
  clipContents = true,
  overlay,
}: TiltSurfaceInner) {
  const canTilt = tiltEnabled !== false && !disabled;
  const { handleMouseMove, handleMouseLeave } = useTiltHandlers(canTilt, onMouseLeave);
  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label={ariaLabel}
      {...(ariaDisabled !== undefined ? { "aria-disabled": ariaDisabled } : {})}
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
      data-tilt-strength={String(DEFAULT_TILT_STRENGTH)}
      className={surfaceClassName(selected, dragging, disabled, className)}
      style={surfaceStyle}
    >
      <TiltSurfaceBody
        clipContents={clipContents}
        shimmerActive={shimmerActive}
        shimmerToken={shimmerToken}
        shimmerRounded={shimmerRounded}
        overlay={overlay}
      >
        {children}
      </TiltSurfaceBody>
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
  surfaceRef,
  testId,
  dataCount,
  onMouseEnter,
  onMouseLeave,
  surfaceStyle,
  tiltEnabled,
  clipContents = true,
  overlay,
}: TiltSurfaceInner) {
  const { handleMouseMove, handleMouseLeave } = useTiltHandlers(tiltEnabled !== false, onMouseLeave);
  return (
    <div
      ref={surfaceRef}
      data-testid={testId}
      {...(dataCount !== undefined ? { "data-count": dataCount } : {})}
      onClick={onDivClick}
      role={onDivClick ? "button" : undefined}
      aria-label={onDivClick ? ariaLabel : undefined}
      onMouseMove={handleMouseMove}
      onMouseEnter={onMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-tilt-strength={String(DEFAULT_TILT_STRENGTH)}
      className={surfaceClassName(selected, dragging, undefined, className)}
      style={surfaceStyle}
    >
      <TiltSurfaceBody
        clipContents={clipContents}
        shimmerActive={shimmerActive}
        shimmerToken={shimmerToken}
        shimmerRounded={shimmerRounded}
        overlay={overlay}
      >
        {children}
      </TiltSurfaceBody>
    </div>
  );
}

export function TiltSurface(props: TiltSurfaceProps) {
  const { as: Component = "div", tiltEnabled = false, baseTransform, style, children, ...rest } = props;
  const surfaceStyle = { "--card-base-transform": baseTransform ?? staticCardTransform, ...style } as CSSProperties;
  if (Component === "button")
    return (
      <TiltSurfaceButton tiltEnabled={tiltEnabled} {...rest} surfaceStyle={surfaceStyle}>
        {children}
      </TiltSurfaceButton>
    );
  return (
    <TiltSurfaceDiv tiltEnabled={tiltEnabled} {...rest} surfaceStyle={surfaceStyle}>
      {children}
    </TiltSurfaceDiv>
  );
}
