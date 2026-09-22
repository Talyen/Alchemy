import type { BattleCard } from "@/lib/game-data";

const CARD_TEXT_CONFIG = {
  numericValuePattern: /\d+/g,
} as const;

export interface CorruptedTextFragment {
  text: string;
  corrupted: boolean;
}

export function getCorruptedValueOffsets(
  card: Pick<BattleCard, "corruptedValuePositions"> | undefined,
  lineIndex: number,
): Set<number> {
  return new Set(
    card?.corruptedValuePositions?.filter((p) => p.lineIndex === lineIndex).map((p) => p.matchIndex) ?? [],
  );
}

export function splitCorruptedNumericParts(
  text: string,
  baseOffset: number,
  corruptedOffsets: Set<number>,
): CorruptedTextFragment[] {
  const fragments: CorruptedTextFragment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(CARD_TEXT_CONFIG.numericValuePattern)) {
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
