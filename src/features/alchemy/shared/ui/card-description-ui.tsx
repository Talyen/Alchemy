// Card text rendering for titles, keyword popups, and corrupted value highlights.
// Depends on game-data keyword metadata, description tokenization, and card text helpers.
// Used by card popups, enemy tooltips, battle cards, shops, and collection previews.
/* eslint-disable react-refresh/only-export-components -- co-located card description components and bare-token utility */
import { Fragment, type ReactNode } from "react";

import type { BattleCard, KeywordId } from "@/lib/game-data";
import { keywordDefinitions } from "@/features/alchemy/shared/config/game-data-catalog";
import { cn } from "@/lib/utils";

import { tooltipBodyLineClass, tooltipHeaderClass } from "../config";
import { tokenizeDescription } from "../utils";
import { KeywordTag } from "./keyword-tag";
import { TooltipBody } from "./tooltip-panel";
import { PortaledTooltip } from "./portaled-tooltip";
import { useHoverVisible } from "./use-hover-visible";
import { getCorruptedValueOffsets, splitCorruptedNumericParts } from "./card-text";

export interface TokenizedTextOptions {
  renderKeyword?: (text: string, keywordId: KeywordId, key: number) => ReactNode;
  renderPlain?: (text: string, key: number) => ReactNode;
}

/** Shared keyword-tokenizing text renderer; defaults to colored keywords with plain fragments. */
export function renderTokenizedDescription(text: string, options?: TokenizedTextOptions): ReactNode[] {
  return tokenizeDescription(text).map((part, index) => {
    if (part.keywordId) {
      const render = options?.renderKeyword;
      return render ? (
        render(part.text, part.keywordId, index)
      ) : (
        <span key={index} className={cn(keywordDefinitions[part.keywordId]?.colorClass, "font-semibold")}>
          {part.text}
        </span>
      );
    }
    const renderPlain = options?.renderPlain;
    return renderPlain ? renderPlain(part.text, index) : <Fragment key={index}>{part.text}</Fragment>;
  });
}

export function renderColoredKeywords(description: string) {
  return renderTokenizedDescription(description);
}

export function KeywordToken({ keywordId, matchedText }: { keywordId: KeywordId; matchedText: string }) {
  const definition = keywordDefinitions[keywordId];
  const { triggerRef, visible, onMouseEnter, onMouseLeave, onFocusCapture, onBlurCapture } =
    useHoverVisible<HTMLSpanElement>();

  return (
    <span
      ref={triggerRef}
      className="relative inline-flex items-center"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocusCapture={onFocusCapture}
      onBlurCapture={onBlurCapture}
    >
      <span className={cn("cursor-help font-semibold", definition.colorClass)}>{matchedText}</span>
      <PortaledTooltip triggerRef={triggerRef} visible={visible}>
        <span className={cn("flex items-center gap-2", tooltipHeaderClass)}>
          <KeywordTag keywordId={keywordId} className="text-sm sm:text-base" />
        </span>
        <TooltipBody>{renderColoredKeywords(definition.description)}</TooltipBody>
      </PortaledTooltip>
    </span>
  );
}

export function DescriptionLines({
  lines,
  idPrefix,
  card,
}: {
  lines: string[];
  idPrefix: string;
  card?: Pick<BattleCard, "corruptedValuePositions">;
}) {
  return (
    <TooltipBody>
      {lines.map((line, lineIndex) => {
        const parts = tokenizeDescription(line);
        const corruptedOffsets = getCorruptedValueOffsets(card, lineIndex);
        let runningLength = 0;
        const partOffsets = parts.map((part) => {
          const offset = runningLength;
          runningLength += part.text.length;
          return offset;
        });

        return (
          <div key={`${idPrefix}-${lineIndex}-${line}`} className={tooltipBodyLineClass}>
            {parts.map((part, index) => {
              if (part.keywordId) {
                return (
                  <span
                    key={`${idPrefix}-${lineIndex}-${index}`}
                    className={cn(keywordDefinitions[part.keywordId]?.colorClass, "font-semibold")}
                  >
                    {part.text}
                  </span>
                );
              }
              const offset = partOffsets[index] ?? 0;
              return splitCorruptedNumericParts(part.text, offset, corruptedOffsets).map((frag, fi) =>
                frag.corrupted ? (
                  <span key={`${idPrefix}-${lineIndex}-${index}-${fi}`} className="text-shine-corruption">
                    {frag.text}
                  </span>
                ) : (
                  <span key={`${idPrefix}-${lineIndex}-${index}-${fi}`}>{frag.text}</span>
                ),
              );
            })}
          </div>
        );
      })}
    </TooltipBody>
  );
}

export function getCardDisplayTitle(card: Pick<BattleCard, "title" | "corrupted">) {
  return card.corrupted ? `Corrupted ${card.title}` : card.title;
}

export function CardTitle({ card, className }: { card: Pick<BattleCard, "title" | "corrupted">; className?: string }) {
  return (
    <span className={cn("font-sans font-semibold", className)}>
      {card.corrupted ? <span className="text-shine-corruption">Corrupted </span> : null}
      {card.title}
    </span>
  );
}
