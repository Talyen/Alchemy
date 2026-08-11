// Interactive battle-card button with tilt, shimmer, selection, and detail popup behavior.
// Depends on card description context, shared card styling, and tilt utilities.
// Used by hand cards, shop cards, rewards, and collection-adjacent selection flows.
import {
  type CSSProperties,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  type Ref,
  type RefObject,
  useRef,
} from "react";

import type { BattleCard } from "@/lib/game-data";
import { cn } from "@/lib/utils";

import { cardArtImageClass, cardSurfaceClass } from "../config";
import { useCardDescriptionContext } from "@/features/alchemy/shared/context/card-description-context";
import { getEffectiveCardDescriptionLines, type CardDescriptionContext } from "../utils/card-description";
import { CardTitle, getCardDisplayTitle } from "./card-description-ui";
import { DetailPopup } from "./card-popup";
import { TiltSurface } from "./tilt-surface";

interface BattleCardButtonProps {
  card: BattleCard;
  hovered: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  onPointerDown?: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  buttonRef?: Ref<HTMLButtonElement>;
  ariaLabel: string;
  shimmerActive: boolean;
  shimmerToken: number | undefined;
  baseTransform?: string;
  className?: string;
  wrapperClassName?: string;
  /** Motion/position only — e.g. stagger index CSS vars or drag ghost coordinates; not for theme colors. */
  wrapperStyle?: CSSProperties;
  wrapperDataCardKey?: string;
  selected?: boolean;
  disabled?: boolean;
  dragging?: boolean;
  tiltEnabled?: boolean;
  descriptionContext?: CardDescriptionContext;
}

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
  const descriptionContext = props.descriptionContext ?? inheritedDescriptionContext;
  const wrapperRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={wrapperRef}
      className={cn("relative", wrapperClassName, dragging && "pointer-events-none")}
      data-hand-card={wrapperDataCardKey ? "true" : undefined}
      data-hand-card-id={wrapperDataCardKey}
      style={wrapperStyle}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
    >
      <CardHoverPopup
        card={card}
        visible={hovered && !dragging}
        triggerRef={wrapperRef}
        descriptionContext={descriptionContext}
      />
      <CardButtonSurface {...props} />
    </div>
  );
}

function CardHoverPopup({
  card,
  visible,
  triggerRef,
  descriptionContext,
}: Pick<BattleCardButtonProps, "card"> & {
  visible: boolean;
  triggerRef: RefObject<HTMLElement | null>;
  descriptionContext: CardDescriptionContext;
}) {
  // Description formatting allocates an effect-cursor and scans every line, so
  // only build it for the card actually being hovered — the render-body call
  // was running for every hand card on every re-render.
  const descriptionLines = visible ? getEffectiveCardDescriptionLines(card, descriptionContext) : [];
  return (
    <DetailPopup
      idPrefix={card.id}
      title={<CardTitle card={card} />}
      subtitle={undefined}
      descriptionLines={descriptionLines}
      visible={visible}
      triggerRef={triggerRef}
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
  tiltEnabled = true,
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
      tiltEnabled={tiltEnabled}
      baseTransform={baseTransform}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onFocus={onHoverStart}
      onBlur={onHoverEnd}
      buttonRef={buttonRef}
      ariaLabel={ariaLabel}
    >
      <img
        src={card.art || "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}
        alt={getCardDisplayTitle(card)}
        className={cn("block h-auto w-full", cardArtImageClass)}
        loading="eager"
      />
    </TiltSurface>
  );
}
