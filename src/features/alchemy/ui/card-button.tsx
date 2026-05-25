// Interactive battle-card button with tilt, shimmer, selection, and detail popup behavior.
// Depends on card description context, shared card styling, and tilt utilities.
// Used by hand cards, shop cards, rewards, and collection-adjacent selection flows.
import { type CSSProperties, type MouseEvent, type PointerEvent as ReactPointerEvent } from "react";

import type { BattleCard } from "@/lib/game-data";
import { cn } from "@/lib/utils";

import { cardArtImageClass, cardSurfaceClass } from "../config";
import { useCardDescriptionContext } from "../homestead-context";
import { getEffectiveCardDescriptionLines, type CardDescriptionContext } from "../utils/card-description";
import { CardTitle, getCardDisplayTitle } from "./card-description-ui";
import { DetailPopup } from "./card-popup";
import { TiltSurface } from "./tilt-surface";

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
  baseTransform,
  className,
  selected = false,
  disabled = false,
  dragging = false,
}: BattleCardButtonProps) {
  return (
    <TiltSurface
      as="button"
      className={cn(cardSurfaceClass, "group", className)}
      shimmerActive={shimmerActive}
      shimmerToken={shimmerToken}
      selected={selected}
      disabled={disabled}
      dragging={dragging}
      baseTransform={baseTransform}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onFocus={onHoverStart}
      onBlur={onHoverEnd}
      buttonRef={buttonRef}
      ariaLabel={ariaLabel}
    >
      <img
        src={card.art}
        alt={getCardDisplayTitle(card)}
        className={`block h-auto w-full ${cardArtImageClass}`}
        loading="eager"
      />
    </TiltSurface>
  );
}
