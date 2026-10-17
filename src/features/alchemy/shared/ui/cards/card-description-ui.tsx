import { useGameTranslation } from "@/components/use-game-translation";
import { text as gameText, displayText } from "@/lib/localization/runtime";
import { Fragment, type ReactNode } from "react";
import { parseRichText, type RichTextNode } from "@/lib/localization/rich-text";

import { renderCardDescription, type BattleCard, type KeywordId } from "@/lib/game-data";
import { keywordDefinitions } from "@/features/alchemy/shared/config/game-data-catalog";
import { cn } from "@/lib/utils";
import { TRANSMUTATION_PREFIXES } from "@/lib/game-constants/transmutation";

import { tooltipBodyLineClass, tooltipHeaderClass } from "../../config/index";
import { buildDescriptionMessage } from "@/lib/game-data";
import { KeywordTag } from "../keyword-tag";
import { TooltipBody, TooltipChip } from "../tooltips/tooltip-panel";
import { PortaledTooltip } from "../tooltips/portaled-tooltip";
import { useHoverVisible } from "../use-hover-visible";

import { ShineText } from "../shine-text";

export { renderColoredKeywords } from "../localized-description";
import { renderColoredKeywords, renderTokenizedDescription, renderMessage } from "../localized-description";

export function renderMultilineTokenizedDescription(text: string): ReactNode[] {
  return text.split("\n").map((line, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {renderTokenizedDescription(line, {
        renderKeyword: (partText, keywordId, key) => (
          <KeywordToken key={key} keywordId={keywordId} matchedText={partText} />
        ),
        renderPlain: (partText, key) => <span key={key}>{displayText(partText)}</span>,
      })}
    </Fragment>
  ));
}

function KeywordToken({ keywordId, matchedText }: { keywordId: KeywordId; matchedText: string }) {
  const i18n = useGameTranslation();
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
            <TooltipBody>
              {i18n.displayText(i18n.read(() => renderColoredKeywords(definition.description)))}
            </TooltipBody>
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
  newLineIndices,
}: {
  lines: string[];
  idPrefix: string;
  newLineIndices?: ReadonlySet<number> | undefined;
  card?: Pick<BattleCard, "effects" | "description">;
}) {
  const i18n = useGameTranslation();
  const rendered =
    card?.effects && card.description ? renderCardDescription(card.effects, card.description) : undefined;
  const content = lines.map((line, lineIndex) => {
    // Context-aware summon lines can differ from the saved description. Only
    // use effect-bound marks when the exact canonical line still corresponds.
    const bound = rendered?.descriptionLines[lineIndex] === line ? rendered.localizedLines[lineIndex] : undefined;
    const message = bound ?? buildDescriptionMessage([{ text: line }]);
    const marks = new Map(
      bound
        ? rendered!.magnitudes
            .filter((entry) => entry.lineIndex === lineIndex)
            .map((entry) => [entry.id, entry.magnitude])
        : [],
    );
    return (
      <div key={`${idPrefix}-${lineIndex}`} className={tooltipBodyLineClass}>
        {i18n.read(() => renderMessage(message, undefined, marks))}
        {newLineIndices?.has(lineIndex) ? (
          <TooltipChip className="ml-1.5 align-middle">{i18n.text("card.new", "NEW")}</TooltipChip>
        ) : null}
      </div>
    );
  });

  return <TooltipBody>{i18n.displayText(content)}</TooltipBody>;
}

type TitleCard = Pick<BattleCard, "title" | "corrupted"> & Partial<Pick<BattleCard, "transmuted" | "baseTitle">>;

function cardTitleMessage(card: TitleCard): string {
  const prefix = card.transmuted ? TRANSMUTATION_PREFIXES[card.transmuted] : undefined;
  const base =
    card.baseTitle ??
    (prefix && card.title.startsWith(`${prefix} `) ? card.title.slice(prefix.length + 1) : card.title);
  let title = displayText(base);
  if (card.transmuted && prefix)
    title = gameText(`card.transmuted.${card.transmuted}`, `<modifier>${prefix}</modifier> {{name}}`, { name: title });
  return card.corrupted
    ? gameText("card.corrupted-title", "<corruption>Corrupted</corruption> {{name}}", { name: title })
    : title;
}

export function getCardDisplayTitle(card: TitleCard): string {
  return cardTitleMessage(card).replace(/<\/?(?:modifier|corruption)>/g, "");
}

export function CardTitle({ card, className }: { card: TitleCard; className?: string }) {
  const i18n = useGameTranslation();
  const title = i18n.read(() => cardTitleMessage(card));
  function render(nodes: RichTextNode[]): ReactNode[] {
    return nodes.map((node, index) => {
      if (node.name === "modifier" && card.transmuted)
        return (
          <ShineText key={index} colors={keywordDefinitions[card.transmuted].shineColors}>
            {render(node.children ?? [])}
          </ShineText>
        );
      if (node.name === "corruption")
        return (
          <span key={index} className="text-shine-corruption">
            {render(node.children ?? [])}
          </span>
        );
      return <Fragment key={index}>{node.text}</Fragment>;
    });
  }
  let children: ReactNode = title;
  try {
    children = render(i18n.read(() => parseRichText(title, new Set(["modifier", "corruption"]))));
  } catch {
    /* Keep unknown legacy titles readable. */
  }
  return <span className={cn("font-sans font-semibold", className)}>{children}</span>;
}
