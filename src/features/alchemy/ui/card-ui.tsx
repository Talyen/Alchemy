import type { CSSProperties, MouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { useEffect } from "react";

import {
  keywordDefinitions,
  type BattleCard,
  type KeywordId,
} from "@/lib/game-data";
import { cn } from "@/lib/utils";

import {
  cardPopupClassName,
  cardSurfaceClass,
  ghostDurations,
  keywordIcons,
  popupClassName,
  staticCardTransform,
} from "../config";
import type { CardGhost, DragPreview, GhostStyle } from "../types";
import { clearTiltFromEvent, setTiltFromEvent, tokenizeDescription } from "../utils";
import { ShimmerOverlay } from "./shared-ui";
import { KeywordTag } from "./keyword-tag";

function KeywordToken({ keywordId, matchedText }: { keywordId: KeywordId; matchedText: string }) {
  const definition = keywordDefinitions[keywordId];
  const Icon = keywordIcons[keywordId];

  return (
    <span className="group/keyword relative inline-flex items-center">
      <span className={cn("cursor-help font-semibold", definition.colorClass)}>{matchedText}</span>
      <div className={cn(popupClassName, "hover-popup-panel pointer-events-none opacity-0 group-hover/keyword:opacity-100")}>
        <div className="flex items-center gap-2">
          <KeywordTag keywordId={keywordId} />
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{definition.description}</p>
      </div>
    </span>
  );
}

function DescriptionLines({ lines, idPrefix }: { lines: string[]; idPrefix: string }) {
  return (
    <div className="mt-2 space-y-1.5 text-sm leading-6 text-muted-foreground">
      {lines.map((line, lineIndex) => {
        const parts = tokenizeDescription(line);

        return (
          <p key={`${idPrefix}-${lineIndex}-${line}`}>
            {parts.map((part, index) =>
              part.keywordId ? (
                <KeywordToken key={`${idPrefix}-${lineIndex}-${index}`} keywordId={part.keywordId} matchedText={part.text} />
              ) : (
                <span key={`${idPrefix}-${lineIndex}-${index}`}>{part.text}</span>
              ),
            )}
          </p>
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
}: {
  idPrefix: string;
  title: string;
  subtitle?: string;
  descriptionLines: string[];
}) {
  return (
    <div
      className={cn(cardPopupClassName, "hover-popup-quick-in pointer-events-auto")}
      style={{ transform: "translate(-50%, calc(-100% - 26px))" } as CSSProperties}
    >
      <p className="text-base font-semibold text-foreground sm:text-lg">{title}</p>
      {subtitle ? <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">{subtitle}</p> : null}
      <DescriptionLines lines={descriptionLines} idPrefix={idPrefix} />
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
  shimmerToken?: number;
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
        <DetailPopup idPrefix={card.id} title={card.title} descriptionLines={card.descriptionLines} />
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

        <img src={card.art} alt={card.title} className="block h-auto w-full rounded-[30px] aspect-[375/524]" loading="lazy" />
      </button>
    </div>
  );
}

export function CardGhostOverlay({ ghost, onDone }: { ghost: CardGhost; onDone: () => void }) {
  useEffect(() => {
    const timeout = window.setTimeout(onDone, ghost.delay + ghostDurations[ghost.variant] + 90);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [ghost.delay, ghost.variant, ghost.id, onDone]);

  return (
    <img
      src={ghost.art}
      alt=""
      aria-hidden="true"
      className={cn(
        "card-ghost-overlay pointer-events-none fixed rounded-[30px] bg-black object-cover shadow-[0_20px_48px_rgba(0,0,0,0.42)]",
        ghost.variant === "draw-in" ? "card-ghost-draw-in" : null,
        ghost.variant === "discard-out" ? "card-ghost-discard-out" : null,
        ghost.variant === "activate" ? "card-ghost-activate" : null,
        ghost.variant === "play-travel" ? "card-ghost-play-travel" : null,
      )}
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

export function DragCardPreview({ preview }: { preview: DragPreview }) {
  return (
    <img
      src={preview.card.art}
      alt=""
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed z-[95] rounded-[30px] bg-black object-cover shadow-[0_26px_54px_rgba(0,0,0,0.45)]",
        "transition-transform duration-75 ease-out",
      )}
      style={{
        left: preview.rect.x,
        top: preview.rect.y,
        width: preview.rect.width,
        height: preview.rect.height,
        transform: `rotate(${preview.rotation}deg)`,
      }}
    />
  );
}
