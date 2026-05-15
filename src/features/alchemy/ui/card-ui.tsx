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
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  cardSurfaceClass,
  popupClassName,
  staticCardTransform,
  viewCardWidthClass,
} from "../config";
import type { CardGhost, GhostStyle } from "../types";
import { clearTiltFromEvent, DEFAULT_TILT_STRENGTH, setTiltFromEvent, tokenizeDescription } from "../utils";
import { DisabledTooltip, GoldCost, ShimmerOverlay } from "./shared-ui";
import { KeywordTag } from "./keyword-tag";
import { getEffectiveCardDescriptionLines, type CardDescriptionContext } from "../utils/card-description";
import { useCardDescriptionContext } from "../homestead-context";

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

function splitCorruptedNumericParts(text: string, baseOffset: number, corruptedOffsets: Set<number>): { text: string; corrupted: boolean }[] {
  const fragments: { text: string; corrupted: boolean }[] = [];
  const numRegex = /\d+/g;
  let lastIndex = 0;
  for (const match of text.matchAll(numRegex)) {
    const matchIndex = match.index ?? 0;
    if (matchIndex > lastIndex) {
      fragments.push({ text: text.slice(lastIndex, matchIndex), corrupted: false });
    }
    fragments.push({ text: match[0], corrupted: corruptedOffsets.has(baseOffset + matchIndex) });
    lastIndex = matchIndex + match[0].length;
  }
  if (lastIndex < text.length) {
    fragments.push({ text: text.slice(lastIndex), corrupted: false });
  }
  return fragments.length > 0 ? fragments : [{ text, corrupted: false }];
}

export function DescriptionLines({ lines, idPrefix, card }: { lines: string[]; idPrefix: string; card?: Pick<BattleCard, "corruptedValuePositions"> }) {
  return (
    <div className="mt-2 space-y-1.5 text-sm leading-6 text-muted-foreground">
      {lines.map((line, lineIndex) => {
        const parts = tokenizeDescription(line);
        const corruptedOffsets = new Set<number>(
          card?.corruptedValuePositions?.filter((p) => p.lineIndex === lineIndex).map((p) => p.matchIndex) ?? [],
        );

        return (
          <div key={`${idPrefix}-${lineIndex}-${line}`}>
            {parts.map((part, index) => {
              if (part.keywordId) {
                return <KeywordToken key={`${idPrefix}-${lineIndex}-${index}`} keywordId={part.keywordId} matchedText={part.text} />;
              }
              const offset = parts.slice(0, index).reduce((acc, p) => acc + p.text.length, 0);
              return splitCorruptedNumericParts(part.text, offset, corruptedOffsets).map((frag, fi) =>
                frag.corrupted ? (
                  <span key={`${idPrefix}-${lineIndex}-${index}-${fi}`} className="text-red-400">{frag.text}</span>
                ) : (
                  <span key={`${idPrefix}-${lineIndex}-${index}-${fi}`}>{frag.text}</span>
                ),
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export function getCardDisplayTitle(card: Pick<BattleCard, "title" | "corrupted">) {
  return card.corrupted ? `Corrupted ${card.title}` : card.title;
}

export function CardTitle({ card, className }: { card: Pick<BattleCard, "title" | "corrupted">; className?: string }) {
  return (
    <span className={className}>
      {card.corrupted ? <span className="text-red-400">Corrupted </span> : null}
      {card.title}
    </span>
  );
}

export function PurchasableCardItem({ card, price, gold, purchased, onBuy, widthClass = viewCardWidthClass }: { card: BattleCard; price: number; gold: number; purchased: boolean; onBuy: () => void; widthClass?: string }) {
  const [hovered, setHovered] = useState(false);

  if (purchased) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-[18px] border border-border/30 bg-card/30 p-4 text-center opacity-50">
        <BattleCardButton card={card} hovered={false} onHoverStart={() => {}} onHoverEnd={() => {}} ariaLabel={getCardDisplayTitle(card)} shimmerActive={false} shimmerToken={undefined} className={widthClass} />
        <p className="text-sm font-semibold text-muted-foreground"><CardTitle card={card} /></p>
        <span className="text-xs text-muted-foreground">Purchased</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-[18px] border border-border/70 bg-card/60 p-4 text-center">
      <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
        <BattleCardButton card={card} hovered={hovered} onHoverStart={() => setHovered(true)} onHoverEnd={() => setHovered(false)} ariaLabel={`Inspect ${getCardDisplayTitle(card)}`} shimmerActive={false} shimmerToken={undefined} className={widthClass} />
      </div>
      <p className="text-sm font-semibold text-foreground"><CardTitle card={card} /></p>
      <DisabledTooltip show={gold < price} message="Not Enough Gold">
        <Button variant="outline" disabled={gold < price} onClick={onBuy}>
          Buy <GoldCost amount={price} />
        </Button>
      </DisabledTooltip>
    </div>
  );
}

export function SelectableShopCard({ card, isSelected, onSelect }: { card: BattleCard; isSelected: boolean; onSelect: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <BattleCardButton
      card={card}
      hovered={hovered}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      onClick={onSelect}
      ariaLabel={`Select ${getCardDisplayTitle(card)}`}
      shimmerActive={false}
      shimmerToken={undefined}
      className={viewCardWidthClass}
      selected={isSelected}
    />
  );
}

export function SelectableCardItem({ card, isSelected, onSelect, widthClass = viewCardWidthClass }: { card: BattleCard; isSelected: boolean; onSelect: () => void; widthClass?: string }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={cn("cursor-pointer rounded-[18px] border p-2 text-center transition-all", isSelected ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-border/60 bg-card/40 hover:border-border")}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onClick={onSelect}
    >
      <BattleCardButton card={card} hovered={hovered} onHoverStart={() => setHovered(true)} onHoverEnd={() => setHovered(false)} ariaLabel={`Inspect ${getCardDisplayTitle(card)}`} shimmerActive={false} shimmerToken={undefined} className={widthClass} />
      <p className="mt-1 text-xs font-semibold text-foreground"><CardTitle card={card} /></p>
    </div>
  );
}

export function DetailPopup({
  idPrefix,
  title,
  subtitle,
  descriptionLines,
  descriptionNodes,
  card,
}: {
  idPrefix: string;
  title: ReactNode;
  subtitle: string | undefined;
  descriptionLines: string[];
  descriptionNodes?: ReactNode[];
  card?: Pick<BattleCard, "corruptedValuePositions">;
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
      <DescriptionLines lines={descriptionLines} idPrefix={idPrefix} {...(card ? { card } : {})} />
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
  shimmerActive,
  shimmerToken,
  baseTransform = staticCardTransform,
  className,
  wrapperClassName,
  wrapperStyle,
  selected = false,
  disabled = false,
  dragging = false,
  descriptionContext,
}: {
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
  selected?: boolean;
  disabled?: boolean;
  dragging?: boolean;
  descriptionContext?: CardDescriptionContext;
}) {
  const inheritedDescriptionContext = useCardDescriptionContext();
  const descriptionLines = getEffectiveCardDescriptionLines(card, descriptionContext ?? inheritedDescriptionContext);

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
  };

  const handleHoverStart = () => {
    onHoverStart();
  };

  return (
    <div className={cn("relative", wrapperClassName)} style={wrapperStyle} onMouseEnter={handleHoverStart} onMouseLeave={onHoverEnd}>
      {hovered ? (
        <DetailPopup idPrefix={card.id} title={<CardTitle card={card} />} subtitle={undefined} descriptionLines={descriptionLines} {...(card.corrupted ? { card } : {})} />
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

        <img src={card.art} alt={getCardDisplayTitle(card)} className="block h-auto w-full rounded-[30px] aspect-[3/4] object-cover" loading="eager" />
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


