import { Fragment, type ReactNode } from "react";

const UNLOCK_HIGHLIGHT_SOURCE = String.raw`\*\*([^*]+)\*\*|\b(Knight|Rogue|Wizard|Ranger|Alchemist|Warlock|Druid|Wildcard|Run|Runs|Gear|Difficulty|Difficulties|Companion|Companions|Gold|Resources|Potions)\b`;

export function renderUnlockMessage(text: string): ReactNode {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const highlightRegex = new RegExp(UNLOCK_HIGHLIGHT_SOURCE, "g");
  let keyCounter = 0;

  while ((match = highlightRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const matchedText = match[1] ?? match[2] ?? match[0];
    parts.push(
      <strong key={`${match.index}-${keyCounter++}`} className="font-semibold text-foreground">
        {matchedText}
      </strong>,
    );
    lastIndex = match.index + match[0].length;
    if (match[0].length === 0) highlightRegex.lastIndex += 1;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? <Fragment>{parts}</Fragment> : text;
}
