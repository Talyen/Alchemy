import {
  createEffectDescription,
  getCardDescription,
  mapCardDescriptionReferences,
  withCardDescription,
  type BattleCard,
  type BattleCardEffect,
  type CardDescription,
} from "@/lib/game-data";

export function countCorruptionEffectLines(card: BattleCard): number {
  return getCardDescription(card).filter((line) => line.role === "effect").length;
}

function insertDescription(
  card: BattleCard,
  added: CardDescription,
  effects: BattleCardEffect[],
  placement: "first" | "before-keywords",
): BattleCard {
  const description = getCardDescription(card);
  const keywordIndex = description.findIndex((line) => line.role !== "effect");
  const lineIndex = placement === "first" ? 0 : keywordIndex < 0 ? description.length : keywordIndex;
  return withCardDescription({ ...card, corrupted: true, effects }, [
    ...description.slice(0, lineIndex),
    ...added,
    ...description.slice(lineIndex),
  ]);
}

export function addCorruptionLine(card: BattleCard, line: string, role: "keyword" | "consume" = "keyword"): BattleCard {
  // Consume remains the final keyword; other keyword lines precede it.
  if (role === "consume")
    return withCardDescription({ ...card, corrupted: true }, [...getCardDescription(card), { parts: [line], role }]);
  return insertDescription(card, [{ parts: [line], role }], card.effects, "before-keywords");
}

export function addCorruptionEffect(
  card: BattleCard,
  effect: BattleCardEffect,
  placement: "first" | "before-keywords" = "before-keywords",
): BattleCard {
  const first = placement === "first";
  const effects = first ? [effect, ...card.effects] : [...card.effects, effect];
  const description = mapCardDescriptionReferences(getCardDescription(card), (reference) => ({
    ...reference,
    effectIndex: reference.effectIndex + (first ? 1 : 0),
  }));
  const added = mapCardDescriptionReferences(
    createEffectDescription([effect]),
    (reference) => ({
      ...reference,
      effectIndex: first ? 0 : card.effects.length,
    }),
    `added/${card.effects.length}`,
  ).map((line) => ({
    ...line,
    parts: line.parts.map((part) => (typeof part === "string" ? part : { ...part, corrupted: true })),
  }));
  return insertDescription({ ...card, description }, added, effects, placement);
}

export function removeConsume(card: BattleCard): BattleCard {
  return withCardDescription(
    {
      ...card,
      corrupted: true,
      consume: false,
      ...(card.tags ? { tags: card.tags.filter((tag) => tag !== "consume") } : {}),
    },
    getCardDescription(card).filter((line) => line.role !== "consume"),
  );
}
