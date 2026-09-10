import {
  type CSSProperties,
  type AriaAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type Ref,
  type SyntheticEvent,
} from "react";

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
  onDivClick?: ((e?: SyntheticEvent<HTMLDivElement>) => void) | undefined;
  onPointerDown?: ((e: PointerEvent<HTMLButtonElement>) => void) | undefined;
  onFocus?: () => void;
  onBlur?: () => void;
  ariaLabel?: string;
  ariaDisabled?: boolean;
  ariaPressed?: boolean;
  ariaCurrent?: AriaAttributes["aria-current"];
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

function handleDivKeyDown(onDivClick: ((e?: SyntheticEvent<HTMLDivElement>) => void) | undefined) {
  return onDivClick
    ? (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onDivClick(event);
        }
      }
    : undefined;
}

export function Surface(props: SurfaceProps) {
  const {
    as: Component = "div",
    baseTransform,
    style,
    children,
    className,
    shimmerActive,
    shimmerToken,
    shimmerRounded,
    selected,
    disabled,
    dragging,
    onClick,
    onDivClick,
    onPointerDown,
    onFocus,
    onBlur,
    ariaLabel,
    ariaDisabled,
    ariaPressed,
    ariaCurrent,
    buttonRef,
    surfaceRef,
    testId,
    dataCount,
    onMouseEnter,
    onMouseLeave,
    clipContents = true,
    hoverScaleActive,
    overlay,
  } = props;

  const surfaceStyle = { "--card-base-transform": baseTransform ?? staticCardTransform, ...style } as CSSProperties;
  const klass = surfaceClassName(selected, dragging, disabled, className);
  const hoveredAttr = hoverScaleActive ? "true" : undefined;
  const divClick = onDivClick ?? onClick;
  const handleDivClick =
    divClick !== undefined
      ? (e?: SyntheticEvent<HTMLDivElement>) => {
          if (!disabled) (divClick as (e?: SyntheticEvent<HTMLDivElement>) => void)(e);
        }
      : undefined;
  const body = (
    <>
      {shimmerActive !== undefined ? (
        <ShimmerOverlay active={shimmerActive} token={shimmerToken} rounded={shimmerRounded ?? "rounded-shell-hero"} />
      ) : null}
      {clipContents ? <div className={CLIP_CONTENTS_CLASS}>{children}</div> : children}
      {overlay}
    </>
  );

  if (Component === "button") {
    return (
      <button
        ref={buttonRef}
        type="button"
        aria-label={ariaLabel}
        aria-current={ariaCurrent}
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
        data-hovered={hoveredAttr}
        className={klass}
        style={surfaceStyle}
      >
        {body}
      </button>
    );
  }

  return (
    <div
      ref={surfaceRef}
      data-testid={testId}
      data-hovered={hoveredAttr}
      {...(dataCount !== undefined ? { "data-count": dataCount } : {})}
      {...(disabled ? { "aria-disabled": "true" } : {})}
      onClick={handleDivClick}
      onKeyDown={handleDivKeyDown(handleDivClick)}
      tabIndex={handleDivClick && !disabled ? 0 : undefined}
      role={handleDivClick ? "button" : undefined}
      aria-label={handleDivClick ? ariaLabel : undefined}
      aria-current={ariaCurrent}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={klass}
      style={surfaceStyle}
    >
      {body}
    </div>
  );
}
