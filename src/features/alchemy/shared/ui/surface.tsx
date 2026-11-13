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

interface SurfaceBaseProps {
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

interface SurfaceProps<T extends "button" | "div"> extends SurfaceBaseProps {
  as?: T;
  onClick?: MouseEventHandler<T extends "button" ? HTMLButtonElement : HTMLDivElement> | undefined;
}

const CLIP_CONTENTS_CLASS = "surface-clip relative w-full overflow-hidden";

export function Surface<T extends "button" | "div" = "div">(props: SurfaceProps<T>) {
  const { buttonRef, surfaceRef, ...view } = props;
  const surfaceStyle = {
    "--card-base-transform": view.baseTransform ?? staticCardTransform,
    ...view.style,
  } as CSSProperties;
  const sharedProps = {
    "data-testid": view.testId,
    "data-hovered": view.hoverScaleActive ? "true" : undefined,
    "aria-current": view.ariaCurrent,
    onFocus: view.onFocus,
    onBlur: view.onBlur,
    onMouseEnter: view.onMouseEnter,
    onMouseLeave: view.onMouseLeave,
    className: cn(
      "surface",
      view.selected && surfaceSelectedRingClass,
      view.dragging && "opacity-0",
      view.disabled && "cursor-default grayscale",
      view.className,
    ),
    style: surfaceStyle,
  };
  const onClick: MouseEventHandler<HTMLElement> | undefined = view.onClick;
  const handleDivClick =
    onClick !== undefined
      ? (e: MouseEvent<HTMLDivElement>) => {
          if (!view.disabled) onClick(e);
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
      {view.shimmerActive !== undefined ? (
        <ShimmerOverlay
          active={view.shimmerActive}
          token={view.shimmerToken}
          rounded={view.shimmerRounded ?? "rounded-shell-hero"}
        />
      ) : null}
      {(view.clipContents ?? true) ? <div className={CLIP_CONTENTS_CLASS}>{view.children}</div> : view.children}
      {view.overlay}
    </>
  );

  if (view.as === "button") {
    return (
      <button
        {...sharedProps}
        ref={buttonRef}
        type="button"
        aria-label={view.ariaLabel}
        aria-disabled={view.ariaDisabled}
        aria-pressed={view.ariaPressed}
        disabled={view.disabled === true || view.dragging === true}
        onClick={onClick}
        onPointerDown={view.onPointerDown}
      >
        {body}
      </button>
    );
  }

  return (
    <div
      {...sharedProps}
      ref={surfaceRef}
      aria-disabled={view.disabled || view.ariaDisabled ? "true" : undefined}
      onClick={handleDivClick}
      onKeyDown={handleDivClick ? handleDivKeyDown : undefined}
      tabIndex={(handleDivClick || view.onFocus) && !view.disabled ? 0 : undefined}
      role={handleDivClick ? "button" : view.onFocus ? "group" : undefined}
      aria-label={handleDivClick || view.onFocus ? view.ariaLabel : undefined}
    >
      {body}
    </div>
  );
}
