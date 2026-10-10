import { Fragment, useMemo, type ReactNode } from "react";

import { renderCardDescription, type BattleCard, type KeywordId } from "@/lib/game-data";
import { keywordDefinitions } from "@/features/alchemy/shared/config/game-data-catalog";
import { cn } from "@/lib/utils";

import { tooltipBodyLineClass, tooltipHeaderClass } from "../../config/index";
import { tokenizeDescription } from "../../utils/index";
import { KeywordTag } from "../keyword-tag";
import { TooltipBody } from "../tooltips/tooltip-panel";
import { PortaledTooltip } from "../tooltips/portaled-tooltip";
import { useHoverVisible } from "../use-hover-visible";
import { getCorruptedValueOffsets, splitCorruptedNumericParts } from "./card-text";

export interface TokenizedTextOptions {
  renderKeyword?: (text: string, keywordId: KeywordId, key: number) => ReactNode;
  renderPlain?: (text: string, key: number) => ReactNode;
}

export function renderTokenizedDescription(text: string, options?: TokenizedTextOptions): ReactNode[] {
  return renderDescription(text, options);
}

function renderDescription(
  text: string,
  options?: Omit<TokenizedTextOptions, "renderPlain"> & {
    renderPlain?: (text: string, key: number, offset: number) => ReactNode;
  },
): ReactNode[] {
  let offset = 0;
  return tokenizeDescription(text).map((part, index) => {
    const start = offset;
    offset += part.text.length;
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
    return renderPlain ? renderPlain(part.text, index, start) : <Fragment key={index}>{part.text}</Fragment>;
  });
}

export function renderColoredKeywords(description: string) {
  return renderTokenizedDescription(description);
}

export function renderMultilineTokenizedDescription(text: string): ReactNode[] {
  return text.split("\n").map((line, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {renderTokenizedDescription(line, {
        renderKeyword: (partText, keywordId, key) => (
          <KeywordToken key={key} keywordId={keywordId} matchedText={partText} />
        ),
        renderPlain: (partText, key) => <span key={key}>{partText}</span>,
      })}
    </Fragment>
  ));
}

function KeywordToken({ keywordId, matchedText }: { keywordId: KeywordId; matchedText: string }) {
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
        {visible ? (
          <>
            <span className={cn("flex items-center gap-2", tooltipHeaderClass)}>
              <KeywordTag keywordId={keywordId} className="text-sm sm:text-base" />
            </span>
            <TooltipBody>{renderColoredKeywords(definition.description)}</TooltipBody>
          </>
        ) : null}
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
  card?: Pick<BattleCard, "corruptedValuePositions"> & Partial<Pick<BattleCard, "effects" | "description">>;
}) {
  const corruptedValuePositions = card?.corruptedValuePositions;
  const effects = card?.effects;
  const description = card?.description;
  const content = useMemo(() => {
    const magnitudes = effects && description ? renderCardDescription(effects, description).magnitudes : [];
    return lines.map((line, lineIndex) => {
      const distilledOffsets = new Set(
        magnitudes
          .filter((entry) => entry.lineIndex === lineIndex && entry.magnitude.distilled)
          .map((entry) => entry.matchIndex),
      );
      const corruptedOffsets = getCorruptedValueOffsets(
        corruptedValuePositions ? { corruptedValuePositions } : undefined,
        lineIndex,
      );

      return (
        <div key={`${idPrefix}-${lineIndex}-${line}`} className={tooltipBodyLineClass}>
          {renderDescription(line, {
            renderPlain: (text, key, offset) => {
              const distilled = splitCorruptedNumericParts(text, offset, distilledOffsets);
              return splitCorruptedNumericParts(text, offset, corruptedOffsets).map((fragment, index) => (
                <span
                  key={`${key}-${index}`}
                  className={
                    distilled[index]?.corrupted ? "text-green-400" : fragment.corrupted ? "text-destructive" : undefined
                  }
                >
                  {fragment.text}
                </span>
              ));
            },
          })}
        </div>
      );
    });
  }, [lines, idPrefix, corruptedValuePositions, effects, description]);

  return <TooltipBody>{content}</TooltipBody>;
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
