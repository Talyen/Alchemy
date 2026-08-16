// Interactive battle-card button with tilt, shimmer, selection, and detail popup behavior.
// Depends on card description context, shared card styling, and tilt utilities.
// Used by hand cards, shop cards, rewards, and collection-adjacent selection flows.
import {
  type CSSProperties,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type Ref,
  type RefObject,
  useEffect,
  useRef,
} from "react";

import { ShineBorder } from "@/components/ui/shine-border";
import { HAND_HOVER_HANDOFF_MS } from "@/lib/game-constants";
import type { BattleCard } from "@/lib/game-data";
import { cn } from "@/lib/utils";

import { cardArtImageClass, cardShineFrameClass, cardSurfaceClass } from "../config";
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
  onClick?: ((event: MouseEvent<HTMLButtonElement>) => void) | undefined;
  onPointerDown?: ((event: ReactPointerEvent<HTMLButtonElement>) => void) | undefined;
  buttonRef?: Ref<HTMLButtonElement> | undefined;
  ariaLabel: string;
  shimmerActive: boolean;
  shimmerToken: number | undefined;
  baseTransform?: string;
  className?: string;
  wrapperClassName?: string;
  /** Motion/position only — e.g. drag ghost coordinates; not for theme colors. */
  wrapperStyle?: CSSProperties;
  wrapperDataCardKey?: string;
  selected?: boolean;
  disabled?: boolean | undefined;
  dragging?: boolean | undefined;
  tiltEnabled?: boolean | undefined;
  descriptionContext?: CardDescriptionContext | undefined;
  /** Keyword shine palette; shown only while hovered/focused and not dragging. */
  shineColor?: readonly string[] | undefined;
  /** Gap between the trigger and the hover detail tooltip. */
  tooltipPadding?: number | undefined;
  children?: ReactNode | undefined;
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
  const hoverEndTimerRef = useRef(0);

  useEffect(() => {
    return () => window.clearTimeout(hoverEndTimerRef.current);
  }, []);

  function handleHoverStart() {
    window.clearTimeout(hoverEndTimerRef.current);
    onHoverStart();
  }

  function handleHoverLeave(event: MouseEvent<HTMLDivElement>) {
    const next = event.relatedTarget;
    if (next instanceof Element && next.closest("[data-hand-card='true']")) {
      return;
    }
    if (!wrapperDataCardKey) {
      onHoverEnd();
      return;
    }
    window.clearTimeout(hoverEndTimerRef.current);
    hoverEndTimerRef.current = window.setTimeout(onHoverEnd, HAND_HOVER_HANDOFF_MS);
  }

  return (
    <div
      ref={wrapperRef}
      className={cn("relative", wrapperClassName, dragging && "pointer-events-none")}
      data-hand-card={wrapperDataCardKey ? "true" : undefined}
      data-hand-card-id={wrapperDataCardKey}
      style={wrapperStyle}
      onMouseEnter={handleHoverStart}
      onMouseLeave={handleHoverLeave}
    >
      <CardHoverPopup
        card={card}
        visible={hovered && !dragging}
        triggerRef={wrapperRef}
        descriptionContext={descriptionContext}
        padding={props.tooltipPadding}
      />
      <CardButtonSurface {...props} onHoverStart={handleHoverStart} />
    </div>
  );
}

function CardHoverPopup({
  card,
  visible,
  triggerRef,
  descriptionContext,
  padding,
}: Pick<BattleCardButtonProps, "card"> & {
  visible: boolean;
  triggerRef: RefObject<HTMLElement | null>;
  descriptionContext: CardDescriptionContext;
  padding?: number | undefined;
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
      {...(padding !== undefined ? { padding } : {})}
      {...(card.corrupted ? { card } : {})}
    />
  );
}

function CardButtonSurface({
  card,
  hovered,
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
  children,
  selected = false,
  disabled = false,
  dragging = false,
  tiltEnabled = true,
  shineColor,
}: BattleCardButtonProps) {
  const showShine = Boolean(hovered && !dragging && shineColor && shineColor.length > 0);
  return (
    <TiltSurface
      as="button"
      className={cn(
        cardSurfaceClass,
        "group",
        showShine && cardShineFrameClass,
        !showShine && "border border-border/80",
        className,
      )}
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
      overlay={
        showShine && shineColor ? <ShineBorder shineColor={shineColor} borderWidth={2} className="z-20" /> : undefined
      }
    >
      <img
        src={card.art || "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}
        alt={getCardDisplayTitle(card)}
        className={cn("block h-auto w-full", cardArtImageClass)}
        loading="eager"
      />
      {children}
    </TiltSurface>
  );
}
