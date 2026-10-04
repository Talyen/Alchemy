import { effectDescriptionLine, type BattleCard, type BattleCardEffect } from "@/lib/game-data";

const trailingKeywords: ReadonlySet<string> = new Set(["Consume", "Archery", "Leech", "Companion"]);

export function countCorruptionEffectLines(card: BattleCard): number {
  return card.descriptionLines.filter((line) => !trailingKeywords.has(line)).length;
}

export function addCorruptionLine(
  card: BattleCard,
  line: string,
  effect?: BattleCardEffect,
  placement: "first" | "before-keywords" = "before-keywords",
): BattleCard {
  const first = placement === "first";
  const keywordIndex =
    line === "Consume" ? -1 : card.descriptionLines.findIndex((entry) => trailingKeywords.has(entry));
  const lineIndex = first ? 0 : keywordIndex < 0 ? card.descriptionLines.length : keywordIndex;
  const descriptionLines = [...card.descriptionLines];
  descriptionLines.splice(lineIndex, 0, line);
  const positions = (card.corruptedValuePositions ?? []).map((pos) => ({
    ...pos,
    lineIndex: pos.lineIndex >= lineIndex ? pos.lineIndex + 1 : pos.lineIndex,
  }));
  for (const match of line.matchAll(/\d+/g)) positions.push({ lineIndex, matchIndex: match.index });
  return {
    ...card,
    corrupted: true,
    descriptionLines,
    effects: effect ? (first ? [effect, ...card.effects] : [...card.effects, effect]) : [...card.effects],
    corruptedValuePositions: positions,
  };
}

export function addCorruptionEffect(
  card: BattleCard,
  effect: BattleCardEffect,
  placement: "first" | "before-keywords" = "before-keywords",
): BattleCard {
  return addCorruptionLine(card, effectDescriptionLine(effect), effect, placement);
}

export function removeConsume(card: BattleCard): BattleCard {
  const descriptionLines: string[] = [];
  const newLineIndices = card.descriptionLines.map((line) => {
    if (line === "Consume") return undefined;
    const lineIndex = descriptionLines.length;
    descriptionLines.push(line);
    return lineIndex;
  });
  const positions = (card.corruptedValuePositions ?? []).flatMap((position) => {
    const lineIndex = newLineIndices[position.lineIndex];
    return lineIndex === undefined ? [] : [{ ...position, lineIndex }];
  });
  return {
    ...card,
    corrupted: true,
    consume: false,
    ...(card.tags ? { tags: card.tags.filter((tag) => tag !== "consume") } : {}),
    descriptionLines,
    corruptedValuePositions: positions,
  };
}
