// Interactive battle-card button with tilt, shimmer, selection, and detail popup behavior.
// Depends on card description context, shared card styling, and tilt utilities.
// Used by hand cards, shop cards, rewards, and collection-adjacent selection flows.
import { type CSSProperties, type MouseEvent, type PointerEvent as ReactPointerEvent } from "react";

import type { BattleCard } from "@/lib/game-data";
import { cn } from "@/lib/utils";

import { cardArtImageClass, cardSurfaceClass, staticCardTransform } from "../config";
import { useCardDescriptionContext } from "../homestead-context";
import { clearTiltFromEvent, DEFAULT_TILT_STRENGTH, setTiltFromEvent } from "../utils";
import { getEffectiveCardDescriptionLines, type CardDescriptionContext } from "../utils/card-description";
import { CardTitle, getCardDisplayTitle } from "./card-description-ui";
import { DetailPopup } from "./card-popup";
import { ShimmerOverlay } from "./shared-ui";

type BattleCardButtonProps = {
  card: BattleCard;
  hovered: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  onPointerDown?: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  buttonRef?: (node: HTMLButtonElement | null) => void;
  ariaLabel: string;
  shimmerActive: boolean;
  shimmerToken: number | undefined;
  baseTransform?: string;
  className?: string;
  wrapperClassName?: string;
  wrapperStyle?: CSSProperties;
  wrapperDataCardKey?: string;
  selected?: boolean;
  disabled?: boolean;
  dragging?: boolean;
  descriptionContext?: CardDescriptionContext;
};

export function BattleCardButton(props: BattleCardButtonProps) {
  const {
    card,
    hovered,
    onHoverStart,
    onHoverEnd,
    wrapperClassName,
    wrapperStyle,
    wrapperDataCardKey,
    dragging = false,
  } = props;
  const inheritedDescriptionContext = useCardDescriptionContext();
  const descriptionLines = getEffectiveCardDescriptionLines(
    card,
    props.descriptionContext ?? inheritedDescriptionContext,
  );

  return (
    <div
      className={cn("relative", wrapperClassName, dragging && "pointer-events-none")}
      data-hand-card={wrapperDataCardKey ? "true" : undefined}
      data-hand-card-id={wrapperDataCardKey}
      style={wrapperStyle}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
    >
      <CardHoverPopup card={card} hovered={hovered} dragging={dragging} descriptionLines={descriptionLines} />
      <CardButtonSurface {...props} />
    </div>
  );
}

function CardHoverPopup({
  card,
  hovered,
  dragging,
  descriptionLines,
}: Pick<BattleCardButtonProps, "card" | "hovered" | "dragging"> & { descriptionLines: string[] }) {
  if (!hovered || dragging) return null;

  return (
    <DetailPopup
      idPrefix={card.id}
      title={<CardTitle card={card} />}
      subtitle={undefined}
      descriptionLines={descriptionLines}
      {...(card.corrupted ? { card } : {})}
    />
  );
}

function CardButtonSurface({
  card,
  onHoverStart,
  onHoverEnd,
  onClick,
  onPointerDown,
  buttonRef,
  ariaLabel,
  shimmerActive,
  shimmerToken,
  baseTransform = staticCardTransform,
  className,
  selected = false,
  disabled = false,
  dragging = false,
}: BattleCardButtonProps) {
  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onFocus={onHoverStart}
      onBlur={onHoverEnd}
      onMouseMove={setTiltFromEvent}
      onMouseLeave={clearTiltFromEvent}
      data-tilt-strength={String(DEFAULT_TILT_STRENGTH)}
      className={cn(
        "tilt-surface group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        cardSurfaceClass,
        className,
        selected ? "ring-2 ring-primary ring-offset-4 ring-offset-background" : null,
        dragging ? "opacity-0" : null,
        disabled ? "cursor-default grayscale" : null,
      )}
      style={{ "--card-base-transform": baseTransform } as CSSProperties}
    >
      <ShimmerOverlay active={shimmerActive} token={shimmerToken} />
      <img
        src={card.art}
        alt={getCardDisplayTitle(card)}
        className={`block h-auto w-full ${cardArtImageClass}`}
        loading="eager"
      />
    </button>
  );
}
