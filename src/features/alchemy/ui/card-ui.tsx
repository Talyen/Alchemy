// Reusable card rendering: descriptions, keyword popups, detail popups, hand buttons, and ghosts.
// Depends on game-data keyword metadata, shared styling, tilt utilities, and ghost animation types.
// Used by battle, shop, rewards, collection, and alchemist UI.
import { Fragment, type CSSProperties, type MouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { useLayoutEffect, useRef, useState } from "react";

import {
  keywordDefinitions,
  type BattleCard,
  type KeywordId,
} from "@/lib/game-data";
import { cn } from "@/lib/utils";

import {
  cardSurfaceClass,
  popupClassName,
  staticCardTransform,
} from "../config";
import type { CardGhost, GhostStyle } from "../types";
import { clearTiltFromEvent, setTiltFromEvent, tokenizeDescription } from "../utils";
import { ShimmerOverlay } from "./shared-ui";
import { KeywordTag } from "./keyword-tag";

export function renderColoredKeywords(description: string) {
  const parts = tokenizeDescription(description);
  return parts.map((part, i) => {
    if (part.keywordId) {
      return (
        <span key={i} className={cn(keywordDefinitions[part.keywordId]?.colorClass, "font-semibold")}>
          {part.text}
        </span>
      );
    }
    return <Fragment key={i}>{part.text}</Fragment>;
  });
}

export function KeywordToken({ keywordId, matchedText }: { keywordId: KeywordId; matchedText: string }) {
  const definition = keywordDefinitions[keywordId];

  return (
    <span className="group/keyword relative inline-flex items-center">
      <span className={cn("cursor-help font-semibold", definition.colorClass)}>{matchedText}</span>
      <span className={cn(popupClassName, "hover-popup-panel pointer-events-none opacity-0 group-hover/keyword:opacity-100")}>
        <span className="flex items-center gap-2 text-base">
          <KeywordTag keywordId={keywordId} />
        </span>
        <span className="mt-2 block text-sm leading-6 text-muted-foreground">{renderColoredKeywords(definition.description)}</span>
      </span>
    </span>
  );
}

export function DescriptionLines({ lines, idPrefix }: { lines: string[]; idPrefix: string }) {
  return (
    <div className="mt-2 space-y-1.5 text-sm leading-6 text-muted-foreground">
      {lines.map((line, lineIndex) => {
        const parts = tokenizeDescription(line);

        return (
          <div key={`${idPrefix}-${lineIndex}-${line}`}>
            {parts.map((part, index) =>
              part.keywordId ? (
                <KeywordToken key={`${idPrefix}-${lineIndex}-${index}`} keywordId={part.keywordId} matchedText={part.text} />
              ) : (
                <span key={`${idPrefix}-${lineIndex}-${index}`}>{part.text}</span>
              ),
            )}
          </div>
        );
      })}
    </div>
  );
}

export function DetailPopup({
  idPrefix,
  title,
  subtitle,
  descriptionLines,
  descriptionNodes,
}: {
  idPrefix: string;
  title: string;
  subtitle: string | undefined;
  descriptionLines: string[];
  descriptionNodes?: ReactNode[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [flip, setFlip] = useState(false);

  useLayoutEffect(() => {
    // Measure after layout and flip below if the popup would leave the viewport; cards near
    // the top edge should remain readable instead of clipping off-screen.
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.top < 0) setFlip(true);
  }, []);

  return (
    <div
      ref={ref}
      className={cn("hover-popup-panel absolute left-1/2 z-40 w-full origin-bottom rounded-[20px] border border-border/80 bg-card px-4 py-3 text-left", "hover-popup-quick-in pointer-events-auto", flip ? "hover-popup-below" : "hover-popup-above")}
      style={{ top: flip ? "100%" : 0, transform: flip ? "translate(-50%, 12px)" : "translate(-50%, calc(-100% - 26px))" } as CSSProperties}
    >
      <p className="text-base text-foreground sm:text-lg">{title}</p>
      {subtitle ? <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">{subtitle}</p> : null}
      <DescriptionLines lines={descriptionLines} idPrefix={idPrefix} />
      {descriptionNodes?.map((node, i) => (
        <div key={i} className="mt-1.5 text-sm leading-6">{node}</div>
      ))}
    </div>
  );
}

export function BattleCardButton({
  card,
  hovered,
  onHoverStart,
  onHoverEnd,
  onClick,
  onPointerDown,
  buttonRef,
  ariaLabel,
  tiltStrength = 16,
  shimmerActive,
  shimmerToken,
  baseTransform = staticCardTransform,
  className,
  wrapperClassName,
  wrapperStyle,
  selected = false,
  disabled = false,
  dragging = false,
}: {
  card: BattleCard;
  hovered: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  onPointerDown?: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  buttonRef?: (node: HTMLButtonElement | null) => void;
  ariaLabel: string;
  tiltStrength?: number;
  shimmerActive: boolean;
  shimmerToken: number | undefined;
  baseTransform?: string;
  className?: string;
  wrapperClassName?: string;
  wrapperStyle?: CSSProperties;
  selected?: boolean;
  disabled?: boolean;
  dragging?: boolean;
}) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
  };

  const handleHoverStart = () => {
    onHoverStart();
  };

  return (
    <div className={cn("relative", wrapperClassName)} style={wrapperStyle} onMouseEnter={handleHoverStart} onMouseLeave={onHoverEnd}>
      {hovered ? (
        <DetailPopup idPrefix={card.id} title={card.title} subtitle={undefined} descriptionLines={card.descriptionLines} />
      ) : null}

      <button
        ref={buttonRef}
        type="button"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={handleClick}
        onPointerDown={onPointerDown}
        onFocus={handleHoverStart}
        onBlur={onHoverEnd}
        onMouseMove={setTiltFromEvent}
        onMouseLeave={clearTiltFromEvent}
        data-tilt-strength={String(tiltStrength)}
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

        <img src={card.art} alt={card.title} className="block h-auto w-full rounded-[30px] aspect-[3/4]" loading="lazy" />
      </button>
    </div>
  );
}

export function CardGhostOverlay({ ghost, onDone }: { ghost: CardGhost; onDone: () => void }) {
  // Ghosts use viewport rects captured before hand/battle state changes. CSS variables carry
  // travel distance, rotation, and scale into keyframes so React does not animate layout.
  return (
    <img
      src={ghost.art}
      alt=""
      aria-hidden="true"
      className={cn(
        "card-ghost-overlay pointer-events-none absolute z-[80] rounded-[30px] bg-black object-cover",
        ghost.variant === "draw-in" ? "card-ghost-draw-in" : null,
        ghost.variant === "discard-out" ? "card-ghost-discard-out" : null,
        ghost.variant === "activate" ? "card-ghost-activate" : null,
        ghost.variant === "play-travel" ? "card-ghost-play-travel" : null,
      )}
      onAnimationEnd={onDone}
      style={
        {
          left: ghost.rect.x,
          top: ghost.rect.y,
          width: ghost.rect.width,
          height: ghost.rect.height,
          animationDelay: `${ghost.delay}ms`,
          "--ghost-rotation": `${ghost.rotation}deg`,
          "--ghost-travel-x": ghost.travel ? `${ghost.travel.x}px` : undefined,
          "--ghost-travel-y": ghost.travel ? `${ghost.travel.y}px` : undefined,
          "--ghost-scale": ghost.travel ? `${ghost.travel.scale}` : undefined,
        } as GhostStyle
      }
    />
  );
}


