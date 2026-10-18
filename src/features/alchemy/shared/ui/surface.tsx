import {
  type CSSProperties,
  type AriaAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type MouseEventHandler,
  type PointerEvent,
  type ReactNode,
  type Ref,
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
  onClick?: MouseEventHandler<HTMLElement> | undefined;
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
  const handleDivClick =
    onClick !== undefined
      ? (e: MouseEvent<HTMLDivElement>) => {
          if (!disabled) onClick(e);
        }
      : undefined;
  function handleDivKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (handleDivClick && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      event.currentTarget.click();
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
        disabled={disabled === true || dragging === true}
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
      aria-disabled={disabled || ariaDisabled ? "true" : undefined}
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
