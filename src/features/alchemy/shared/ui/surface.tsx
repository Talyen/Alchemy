import { type CSSProperties, type MouseEvent, type PointerEvent, type ReactNode, type Ref } from "react";

import { cn } from "@/lib/utils";

import { staticCardTransform, surfaceSelectedRingClass } from "../config/layout";
import { ShimmerOverlay } from "./shimmer";

interface SurfaceProps {
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

  clipContents?: boolean | undefined;

  hoverScaleActive?: boolean | undefined;

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

const SURFACE_CLASSES = "surface";
const CLIP_CONTENTS_CLASS = "surface-clip relative w-full overflow-hidden";

function surfaceClassName(
  selected: boolean | undefined,
  dragging: boolean | undefined,
  disabled: boolean | undefined,
  className: string | undefined,
) {
  return cn(
    SURFACE_CLASSES,
    selected && surfaceSelectedRingClass,
    dragging && "opacity-0",
    disabled && "cursor-default grayscale",
    className,
  );
}

function SurfaceBody({
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

interface SurfaceInner extends SurfaceProps {
  surfaceStyle: CSSProperties;
  children: ReactNode;
}

function SurfaceButton({
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
  clipContents = true,
  overlay,
  hoverScaleActive,
}: SurfaceInner) {
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
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      data-testid={testId}
      data-hovered={hoverScaleActive ? "true" : undefined}
      className={surfaceClassName(selected, dragging, disabled, className)}
      style={surfaceStyle}
    >
      <SurfaceBody
        clipContents={clipContents}
        shimmerActive={shimmerActive}
        shimmerToken={shimmerToken}
        shimmerRounded={shimmerRounded}
        overlay={overlay}
      >
        {children}
      </SurfaceBody>
    </button>
  );
}

function SurfaceDiv(props: SurfaceInner) {
  const {
    children,
    className,
    shimmerActive,
    shimmerToken,
    shimmerRounded,
    selected,
    disabled,
    dragging,
    onDivClick,
    ariaLabel,
    surfaceRef,
    testId,
    dataCount,
    onMouseEnter,
    onMouseLeave,
    surfaceStyle,
    clipContents = true,
    overlay,
    hoverScaleActive,
  } = props;
  return (
    <div
      ref={surfaceRef}
      data-testid={testId}
      data-hovered={hoverScaleActive ? "true" : undefined}
      {...(dataCount !== undefined ? { "data-count": dataCount } : {})}
      onClick={onDivClick}
      onKeyDown={
        onDivClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                (onDivClick as (e?: unknown) => void)();
              }
            }
          : undefined
      }
      tabIndex={onDivClick ? 0 : undefined}
      role={onDivClick ? "button" : undefined}
      aria-label={onDivClick ? ariaLabel : undefined}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={surfaceClassName(selected, dragging, disabled, className)}
      style={surfaceStyle}
    >
      <SurfaceBody
        clipContents={clipContents}
        shimmerActive={shimmerActive}
        shimmerToken={shimmerToken}
        shimmerRounded={shimmerRounded}
        overlay={overlay}
      >
        {children}
      </SurfaceBody>
    </div>
  );
}

export function Surface(props: SurfaceProps) {
  const { as: Component = "div", baseTransform, style, children, ...rest } = props;
  const surfaceStyle = { "--card-base-transform": baseTransform ?? staticCardTransform, ...style } as CSSProperties;
  if (Component === "button")
    return (
      <SurfaceButton {...rest} surfaceStyle={surfaceStyle}>
        {children}
      </SurfaceButton>
    );
  return (
    <SurfaceDiv {...rest} surfaceStyle={surfaceStyle}>
      {children}
    </SurfaceDiv>
  );
}
