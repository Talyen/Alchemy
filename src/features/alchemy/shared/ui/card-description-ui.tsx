// Card text rendering for titles, keyword popups, and corrupted value highlights.
// Depends on game-data keyword metadata, description tokenization, and card text helpers.
// Used by card popups, enemy tooltips, battle cards, shops, and collection previews.
/* eslint-disable react-refresh/only-export-components -- co-located card description components and bare-token utility */
import { Fragment } from "react";

import type { BattleCard, KeywordId } from "@/lib/game-data";
import { keywordDefinitions } from "@/features/alchemy/shared/config/game-data-catalog";
import { cn } from "@/lib/utils";

import { tokenizeDescription } from "../utils";
import { KeywordTag } from "./keyword-tag";
import { TooltipBody } from "./tooltip-panel";
import { PortaledTooltip } from "./portaled-tooltip";
import { useHoverVisible } from "./use-hover-visible";
import { getCorruptedValueOffsets, splitCorruptedNumericParts } from "./card-text";

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
        <span className="flex items-center gap-2 text-sm font-semibold">
          <KeywordTag keywordId={keywordId} />
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
          <div key={`${idPrefix}-${lineIndex}-${line}`}>
            {parts.map((part, index) => {
              if (part.keywordId) {
                return (
                  <KeywordToken
                    key={`${idPrefix}-${lineIndex}-${index}`}
                    keywordId={part.keywordId}
                    matchedText={part.text}
                  />
                );
              }
              const offset = partOffsets[index] ?? 0;
              return splitCorruptedNumericParts(part.text, offset, corruptedOffsets).map((frag, fi) =>
                frag.corrupted ? (
                  <span key={`${idPrefix}-${lineIndex}-${index}-${fi}`} className="text-red-400">
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
      {card.corrupted ? <span className="text-red-400">Corrupted </span> : null}
      {card.title}
    </span>
  );
}
