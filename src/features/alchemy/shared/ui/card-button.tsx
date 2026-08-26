// Interactive battle-card button with hover scale, shimmer, selection, and detail popup behavior.
import {
  type CSSProperties,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type Ref,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";

import { ShineBorder } from "@/components/ui/shine-border";
import { HAND_HOVER_HANDOFF_MS } from "@/lib/game-constants";
import type { BattleCard } from "@/lib/game-data";
import { cn } from "@/lib/utils";

import {
  cardArtImageClass,
  cardHoverScaleClass,
  cardShineFrameClass,
  cardSurfaceClass,
  getPlasmaColorPairForCard,
} from "../config";
import { useCardDescriptionContext } from "@/features/alchemy/shared/context/card-description-context";
import { getEffectiveCardDescriptionLines, type CardDescriptionContext } from "@/lib/game-data";
import { CardTitle, getCardDisplayTitle } from "./card-description-ui";
import { DetailPopup } from "./card-popup";
import { TiltSurface } from "./tilt-surface";

interface BattleCardButtonBaseProps {
  card: BattleCard;
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
  scaleOnHover?: boolean | undefined;
  descriptionContext?: CardDescriptionContext | undefined;
  /** Keyword shine palette; shown only while hovered/focused and not dragging. */
  shineColor?: readonly string[] | undefined;
  /** Gap between the trigger and the hover detail tooltip. */
  tooltipPadding?: number | undefined;
  children?: ReactNode | undefined;
}

// Hover control: pass all three props to drive hover externally (hand-style
// handoff timing), or none to let the button track hover itself. Passing a
// partial set is a compile error because either half would be silently ignored.
export type BattleCardButtonProps = BattleCardButtonBaseProps &
  (
    | { hovered?: undefined; onHoverStart?: undefined; onHoverEnd?: undefined }
    | { hovered: boolean; onHoverStart: () => void; onHoverEnd: () => void }
  );

export function BattleCardButton(props: BattleCardButtonProps) {
  const { wrapperClassName, wrapperStyle, wrapperDataCardKey, dragging = false } = props;
  const inheritedDescriptionContext = useCardDescriptionContext();
  const descriptionContext = props.descriptionContext ?? inheritedDescriptionContext;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const hoverEndTimerRef = useRef(0);
  const [internalHovered, setInternalHovered] = useState(false);
  // Hand-style call sites control hover for handoff timing; simple call sites
  // omit the props and get self-contained hover behavior.
  const isControlledHover = props.onHoverStart !== undefined || props.onHoverEnd !== undefined;
  const hovered = isControlledHover ? (props.hovered ?? false) : internalHovered;

  useEffect(() => {
    return () => window.clearTimeout(hoverEndTimerRef.current);
  }, []);

  function handleHoverStart() {
    window.clearTimeout(hoverEndTimerRef.current);
    if (isControlledHover) props.onHoverStart?.();
    else setInternalHovered(true);
  }

  function handleHoverEnd() {
    window.clearTimeout(hoverEndTimerRef.current);
    if (isControlledHover) props.onHoverEnd?.();
    else setInternalHovered(false);
  }

  function handleHoverLeave(event: MouseEvent<HTMLDivElement>) {
    const next = event.relatedTarget;
    if (next instanceof Element && next.closest("[data-hand-card='true']")) {
      return;
    }
    if (!wrapperDataCardKey) {
      handleHoverEnd();
      return;
    }
    window.clearTimeout(hoverEndTimerRef.current);
    hoverEndTimerRef.current = window.setTimeout(handleHoverEnd, HAND_HOVER_HANDOFF_MS);
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
        card={props.card}
        visible={hovered && !dragging}
        triggerRef={wrapperRef}
        descriptionContext={descriptionContext}
        padding={props.tooltipPadding}
      />
      <CardButtonSurface {...props} hovered={hovered} onHoverStart={handleHoverStart} onHoverEnd={handleHoverEnd} />
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
      plasmaColorPair={getPlasmaColorPairForCard(card)}
      {...(padding !== undefined ? { padding } : {})}
      {...(card.corrupted ? { card } : {})}
    />
  );
}

function CardButtonSurface({
  card,
  hovered,
  onHoverStart = () => {},
  onHoverEnd = () => {},
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
  scaleOnHover = true,
  shineColor,
}: BattleCardButtonProps) {
  const showShine = Boolean(hovered && !dragging && shineColor && shineColor.length > 0);
  return (
    <TiltSurface
      as="button"
      className={cn(
        cardSurfaceClass,
        "group",
        scaleOnHover && cardHoverScaleClass,
        showShine && cardShineFrameClass,
        !showShine && "border border-border/80",
        className,
      )}
      shimmerActive={shimmerActive}
      shimmerToken={shimmerToken}
      selected={selected}
      disabled={disabled}
      dragging={dragging}
      baseTransform={baseTransform}
      hoverScaleActive={Boolean(scaleOnHover && hovered && !dragging)}
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
