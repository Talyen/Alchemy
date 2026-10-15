import { text as gameText } from "@/lib/localization/runtime";
import { Fragment, type ReactNode } from "react";
import { buildDescriptionMessage, type DescriptionMessageValue, type KeywordId } from "@/lib/game-data";
import { keywordDefinitions } from "../config/game-data-catalog";
import { cn } from "@/lib/utils";
import { parseRichText, type RichTextNode } from "@/lib/localization/rich-text";

export interface TokenizedTextOptions {
  renderKeyword?: (text: string, keywordId: KeywordId, key: number) => ReactNode;
  renderResource?: (text: string, resourceId: string, key: number) => ReactNode;
  renderPlain?: (text: string, key: number) => ReactNode;
}

export function renderTokenizedDescription(text: string, options?: TokenizedTextOptions): ReactNode[] {
  return renderDescription(text, options);
}

function renderDescription(text: string, options?: TokenizedTextOptions): ReactNode[] {
  return renderMessage(buildDescriptionMessage([{ text }]), options);
}

export function renderMessage(
  message: DescriptionMessageValue,
  options?: TokenizedTextOptions,
  marks: ReadonlyMap<string, { corrupted?: boolean; distilled?: boolean }> = new Map(),
): ReactNode[] {
  const translated = gameText(message.id, message.template, message.values);
  let nodes: RichTextNode[];
  try {
    nodes = parseRichText(translated, new Set(Object.keys(message.slots)));
  } catch {
    return [<Fragment key="legacy">{translated}</Fragment>];
  }
  let key = 0;
  function render(nodes: RichTextNode[]): ReactNode[] {
    return nodes.map((node) => {
      const index = key++;
      if (node.text !== undefined)
        return options?.renderPlain?.(node.text, index) ?? <Fragment key={index}>{node.text}</Fragment>;
      const slot = message.slots[node.name!];
      const children = render(node.children ?? []);
      if (slot && "resourceId" in slot) {
        const word = (node.children ?? []).map((child) => child.text ?? "").join("");
        return options?.renderResource?.(word, slot.resourceId, index) ?? <Fragment key={index}>{children}</Fragment>;
      }
      if (slot && "keywordId" in slot) {
        const word = (node.children ?? []).map((child) => child.text ?? "").join("");
        return options?.renderKeyword ? (
          options.renderKeyword(word, slot.keywordId, index)
        ) : (
          <span key={index} className={cn(keywordDefinitions[slot.keywordId].colorClass, "font-semibold")}>
            {children}
          </span>
        );
      }
      const mark = slot && "magnitudeId" in slot ? marks.get(slot.magnitudeId) : undefined;
      return (
        <span
          key={index}
          className={mark?.distilled ? "text-green-400" : mark?.corrupted ? "text-destructive" : undefined}
        >
          {children}
        </span>
      );
    });
  }
  return render(nodes);
}

export function renderColoredKeywords(description: string) {
  return renderTokenizedDescription(description);
}
