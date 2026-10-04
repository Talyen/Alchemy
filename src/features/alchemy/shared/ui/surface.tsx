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

const CLIP_CONTENTS_CLASS = "surface-clip relative w-full overflow-hidden";

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
  const sharedProps = {
    "data-testid": testId,
    "data-hovered": hoverScaleActive ? "true" : undefined,
    "aria-current": ariaCurrent,
    onFocus,
    onBlur,
    onMouseEnter,
    onMouseLeave,
    className: cn(
      "surface",
      selected && surfaceSelectedRingClass,
      dragging && "opacity-0",
      disabled && "cursor-default grayscale",
      className,
    ),
    style: surfaceStyle,
  };
  const divClick = onDivClick ?? onClick;
  const handleDivClick =
    divClick !== undefined
      ? (e?: SyntheticEvent<HTMLDivElement>) => {
          if (!disabled) (divClick as (e?: SyntheticEvent<HTMLDivElement>) => void)(e);
        }
      : undefined;
  function handleDivKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (handleDivClick && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      handleDivClick(event);
    }
  }
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
        {...sharedProps}
        ref={buttonRef}
        type="button"
        aria-label={ariaLabel}
        aria-disabled={ariaDisabled}
        aria-pressed={ariaPressed}
        disabled={disabled}
        onClick={onClick}
        onPointerDown={onPointerDown}
      >
        {body}
      </button>
    );
  }

  return (
    <div
      {...sharedProps}
      ref={surfaceRef}
      data-count={dataCount}
      aria-disabled={disabled ? "true" : undefined}
      onClick={handleDivClick}
      onKeyDown={handleDivClick ? handleDivKeyDown : undefined}
      tabIndex={(handleDivClick || onFocus) && !disabled ? 0 : undefined}
      role={handleDivClick ? "button" : onFocus ? "group" : undefined}
      aria-label={handleDivClick || onFocus ? ariaLabel : undefined}
    >
      {body}
    </div>
  );
}
