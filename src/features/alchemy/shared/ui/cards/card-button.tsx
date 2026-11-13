import { isFocusNavigationEnabled } from "../dialogs/focus-input";
import { useGameTranslation } from "@/components/use-game-translation";

import {
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type Ref,
  type RefObject,
  useMemo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { ShineBorder } from "@/components/ui/shine-border";
import { type BattleCard } from "@/lib/game-data";
import { cn } from "@/lib/utils";

import {
  cardArtImageClass,
  cardHoverScaleClass,
  cardArtFrameClass,
  getPlasmaColorPairForCard,
  getCardInspectionShineColors,
} from "../../config/index";
import { useCardDescriptionContext } from "@/features/alchemy/shared/context/card-description-context";
import { getEffectiveCardDescriptionLines, type CardDescriptionContext } from "@/lib/game-data";
import { CardTitle, getCardDisplayTitle } from "./card-description-ui";
import { DetailPopup } from "../tooltips/card-popup";
import { Surface } from "../surface";

interface BattleCardButtonBaseProps {
  card: BattleCard;
  comparisonCard?: BattleCard | undefined;
  onClick?: ((event: MouseEvent<HTMLButtonElement>) => void) | undefined;
  onPointerDown?: ((event: ReactPointerEvent<HTMLButtonElement>) => void) | undefined;
  buttonRef?: Ref<HTMLButtonElement> | undefined;
  ariaLabel: string;
  shimmerActive?: boolean;
  shimmerToken?: number | undefined;
  baseTransform?: string;
  className?: string;
  wrapperClassName?: string;
  wrapperDataCardKey?: string;
  selected?: boolean;
  disabled?: boolean | undefined;
  ariaDisabled?: boolean | undefined;
  ariaPressed?: boolean | undefined;
  dragging?: boolean | undefined;
  scaleOnHover?: boolean | undefined;
  descriptionContext?: CardDescriptionContext | undefined;

  shineColor?: readonly string[] | undefined;

  suppressTooltip?: boolean | undefined;

  tooltipPadding?: number | undefined;
  children?: ReactNode | undefined;
}

export type BattleCardButtonProps = BattleCardButtonBaseProps &
  (
    | { hovered?: undefined; onHoverStart?: undefined; onHoverEnd?: undefined }
    | { hovered: boolean; onHoverStart: () => void; onHoverEnd: () => void }
  );

export function BattleCardButton(props: BattleCardButtonProps) {
  const i18n = useGameTranslation();
  const { wrapperClassName, wrapperDataCardKey, dragging = false, suppressTooltip = false } = props;
  const inheritedDescriptionContext = useCardDescriptionContext();
  const descriptionContext = props.descriptionContext ?? inheritedDescriptionContext;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const pointerInsideRef = useRef(false);
  const focusedRef = useRef(false);
  const [internalHovered, setInternalHovered] = useState(false);

  const isControlledHover = props.onHoverStart !== undefined || props.onHoverEnd !== undefined;
  const hovered = isControlledHover ? (props.hovered ?? false) : internalHovered;

  function handleHoverStart() {
    if (isControlledHover) props.onHoverStart?.();
    else setInternalHovered(true);
  }

  const onHoverEnd = props.onHoverEnd;
  const handleHoverEnd = useCallback(() => {
    if (pointerInsideRef.current || (focusedRef.current && isFocusNavigationEnabled())) return;
    if (isControlledHover) onHoverEnd?.();
    else setInternalHovered(false);
  }, [isControlledHover, onHoverEnd]);

  useEffect(() => {
    if (!hovered) return;
    const onWheel = () => {
      focusedRef.current = false;
      handleHoverEnd();
    };
    document.addEventListener("wheel", onWheel, { capture: true, passive: true });
    return () => {
      document.removeEventListener("wheel", onWheel, true);
    };
  }, [hovered, handleHoverEnd]);

  function handleHoverLeave(event: MouseEvent<HTMLDivElement>) {
    pointerInsideRef.current = false;
    const next = event.relatedTarget;
    if (wrapperDataCardKey && next instanceof Element && next.closest("[data-hand-card='true']")) {
      return;
    }
    handleHoverEnd();
  }

  const colors = props.shineColor ?? (props.card.transmuted ? getCardInspectionShineColors(props.card) : undefined);
  const showShine = Boolean(hovered && !dragging && !(props.disabled ?? false) && colors?.length);
  const artwork = (
    <img
      src={props.card.art || "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}
      alt={i18n.read(() => getCardDisplayTitle(props.card))}
      className={cn("block h-auto w-full", cardArtImageClass)}
      loading="eager"
      decoding="async"
    />
  );

  return (
    <div
      ref={wrapperRef}
      className={cn("relative", wrapperClassName, dragging && "pointer-events-none")}
      data-hand-card={wrapperDataCardKey ? "true" : undefined}
      data-hand-card-id={wrapperDataCardKey}
      onMouseEnter={() => {
        pointerInsideRef.current = true;
        handleHoverStart();
      }}
      onMouseLeave={handleHoverLeave}
    >
      <CardHoverPopup
        card={props.card}
        comparisonCard={props.comparisonCard}
        visible={hovered && !dragging && !suppressTooltip}
        triggerRef={wrapperRef}
        descriptionContext={descriptionContext}
        padding={props.tooltipPadding}
      />
      <Surface
        as="button"
        className={cn(
          cardArtFrameClass,
          "group",
          (props.scaleOnHover ?? true) && cardHoverScaleClass,
          showShine && "card-art-shine",
          props.className,
        )}
        shimmerActive={props.shimmerActive ?? false}
        shimmerToken={props.shimmerToken}
        selected={props.selected ?? false}
        {...(props.ariaPressed !== undefined ? { ariaPressed: props.ariaPressed } : {})}
        disabled={props.disabled ?? false}
        {...(props.ariaDisabled !== undefined ? { ariaDisabled: props.ariaDisabled } : {})}
        dragging={dragging}
        baseTransform={props.baseTransform}
        hoverScaleActive={(props.scaleOnHover ?? true) && hovered && !dragging}
        onClick={props.onClick}
        onPointerDown={props.onPointerDown}
        onFocus={() => {
          if (!isFocusNavigationEnabled()) return;
          focusedRef.current = true;
          handleHoverStart();
        }}
        onBlur={() => {
          focusedRef.current = false;
          handleHoverEnd();
        }}
        buttonRef={props.buttonRef}
        ariaLabel={props.ariaLabel}
        overlay={showShine && colors ? <ShineBorder shineColor={colors} borderWidth={2} className="z-20" /> : undefined}
      >
        {artwork}
        {props.children}
      </Surface>
    </div>
  );
}

function CardHoverPopup({
  card,
  comparisonCard,
  visible,
  triggerRef,
  descriptionContext,
  padding,
}: Pick<BattleCardButtonProps, "card" | "comparisonCard"> & {
  visible: boolean;
  triggerRef: RefObject<HTMLElement | null>;
  descriptionContext: CardDescriptionContext;
  padding?: number | undefined;
}) {
  const i18n = useGameTranslation();
  const inspectedCard = useMemo(
    () => (visible ? (descriptionContext.inspectBattleCard?.(card) ?? card) : card),
    [visible, card, descriptionContext],
  );
  const descriptionLines = useMemo(
    () => (visible ? getEffectiveCardDescriptionLines(inspectedCard, descriptionContext) : []),
    [visible, inspectedCard, descriptionContext],
  );
  const newLineIndices = useMemo(() => {
    if (!visible || !comparisonCard) return undefined;
    const remaining = new Map<string, number>();
    for (const line of getEffectiveCardDescriptionLines(
      descriptionContext.inspectBattleCard?.(comparisonCard) ?? comparisonCard,
      descriptionContext,
    )) {
      remaining.set(line, (remaining.get(line) ?? 0) + 1);
    }
    const changed = new Set<number>();
    descriptionLines.forEach((line, index) => {
      const count = remaining.get(line) ?? 0;
      if (count > 0) remaining.set(line, count - 1);
      else changed.add(index);
    });
    return changed;
  }, [visible, comparisonCard, descriptionContext, descriptionLines]);
  const plasmaColorPair = useMemo(() => (visible ? getPlasmaColorPairForCard(card) : null), [visible, card]);
  return (
    <DetailPopup
      idPrefix={card.id}
      title={i18n.displayText(<CardTitle card={card} />)}
      subtitle={undefined}
      descriptionLines={descriptionLines}
      newLineIndices={newLineIndices}
      visible={visible}
      triggerRef={triggerRef}
      plasmaColorPair={plasmaColorPair}
      {...(padding !== undefined ? { padding } : {})}
      card={inspectedCard}
    />
  );
}
