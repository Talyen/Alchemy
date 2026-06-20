// Card text rendering for titles, keyword popups, and corrupted value highlights.
// Depends on game-data keyword metadata, description tokenization, and card text helpers.
// Used by card popups, enemy tooltips, battle cards, shops, and collection previews.
/* eslint-disable react-refresh/only-export-components */
import { Fragment } from "react";

import { keywordDefinitions, type BattleCard, type KeywordId } from "@/lib/game-data";
import { cn } from "@/lib/utils";

import { tokenizeDescription } from "../utils";
import { KeywordTag } from "./keyword-tag";
import { TooltipPanel, useTooltipViewportClamp } from "./tooltip-panel";
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
  const { ref, flip, dx } = useTooltipViewportClamp(8, keywordId);

  return (
    <span className="group/keyword relative inline-flex items-center">
      <span className={cn("cursor-help font-semibold", definition.colorClass)}>{matchedText}</span>
      <TooltipPanel
        ref={ref}
        flip={flip}
        style={dx !== 0 ? { marginLeft: dx } : undefined}
        className="pointer-events-none opacity-0 group-hover/keyword:opacity-100"
      >
        <span className="flex items-center gap-2 text-base">
          <KeywordTag keywordId={keywordId} />
        </span>
        <span className="mt-2 block text-sm leading-6 text-muted-foreground">
          {renderColoredKeywords(definition.description)}
        </span>
      </TooltipPanel>
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
    <div className="mt-2 space-y-1.5 text-sm leading-6 text-muted-foreground">
      {lines.map((line, lineIndex) => {
        const parts = tokenizeDescription(line);
        const corruptedOffsets = getCorruptedValueOffsets(card, lineIndex);

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
              const offset = parts.slice(0, index).reduce((acc, p) => acc + p.text.length, 0);
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
    </div>
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
