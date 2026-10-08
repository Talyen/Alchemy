import { effectChildren } from "./effect-tree";
import type { BattleCard, BattleCardEffect } from "./types";

export interface CardEffectAddress {
  effectIndex: number;
  effectPath?: number[];
}

export const CARD_MAGNITUDE_FIELDS = [
  "amount",
  "blockDamageBonus",
  "amountIfTargetFrozen",
  "minAmount",
  "maxAmount",
  "perManaCrystal",
  "convertCurrentMana",
  "equalToGoldPercent",
] as const;

type NumericField<E> = {
  [F in keyof E]-?: NonNullable<E[F]> extends number ? F : never;
}[keyof E] &
  string;

export type CardMagnitudeReference = {
  [K in BattleCardEffect["kind"]]: CardEffectAddress & {
    kind: K;
    field: NumericField<Extract<BattleCardEffect, { kind: K }>> & (typeof CARD_MAGNITUDE_FIELDS)[number];
    multiplier?: 1 | 2;
  };
}[BattleCardEffect["kind"]];

export const CARD_MAGNITUDE_FORMATS = ["number", "draw", "companion", "cleanse", "crystals", "turns"] as const;

export interface CardMagnitude {
  kind: "magnitude";
  id: string;
  references: CardMagnitudeReference[];
  format?: (typeof CARD_MAGNITUDE_FORMATS)[number];
  editable?: boolean;
  corrupted?: boolean;
}

export type CardDescriptionPart = string | CardMagnitude;
interface CardDescriptionLine {
  parts: CardDescriptionPart[];
  role: "effect" | "keyword" | "consume";
}
export type CardDescription = CardDescriptionLine[];

export function cardMagnitude(
  reference: CardMagnitudeReference,
  options: Omit<CardMagnitude, "kind" | "id" | "references"> & { shared?: CardMagnitudeReference[] } = {},
): CardMagnitude {
  const { shared = [], ...format } = options;
  const id = `${[reference.effectIndex, ...(reference.effectPath ?? [])].join("/")}:${reference.field}`;
  return { kind: "magnitude", id, references: [reference, ...shared], ...format };
}

export function getCardEffect(
  effects: readonly BattleCardEffect[],
  address: CardEffectAddress,
): BattleCardEffect | undefined {
  let effect = effects[address.effectIndex];
  for (const index of address.effectPath ?? []) {
    if (!effect) return undefined;
    effect = effectChildren(effect)[index];
  }
  return effect;
}

function cardMagnitudeValue(effects: readonly BattleCardEffect[], magnitude: CardMagnitude): number | null {
  let value: number | null = null;
  for (const reference of magnitude.references) {
    const effect = getCardEffect(effects, reference);
    if (!effect || effect.kind !== reference.kind) return null;
    const fieldValue = (effect as Record<string, unknown>)[reference.field];
    if (typeof fieldValue !== "number" || !Number.isFinite(fieldValue)) return null;
    const next = fieldValue / (reference.multiplier ?? 1);
    if (value !== null && next !== value) return null;
    value = next;
  }
  return value;
}

function formatMagnitude(value: number, format: CardMagnitude["format"]): string {
  switch (format) {
    case "draw":
      return value === 1 ? "a card" : `${value} cards`;
    case "companion":
      return value === 1 ? "once" : value === 2 ? "twice" : `${value} times`;
    case "cleanse":
      return value === 1 ? "a harmful status effect" : `${value} harmful status effects`;
    case "crystals":
      return `${value} Mana Crystal${value === 1 ? "" : "s"}`;
    case "turns":
      return value === 1 ? "an extra turn" : `${value} extra turns`;
    case "number":
    case undefined:
      return String(value);
  }
}

export interface RenderedCardMagnitude {
  id: string;
  magnitude: CardMagnitude;
  value: number;
  lineIndex: number;
  matchIndex: number;
}

function referenceKey(reference: CardMagnitudeReference): string {
  return `${reference.kind}/${reference.effectIndex}/${(reference.effectPath ?? []).join("/")}/${reference.field}`;
}

function magnitudeSignature(magnitude: CardMagnitude): string {
  return magnitude.references.map((reference) => `${referenceKey(reference)}/${reference.multiplier ?? 1}`).join("|");
}

/** Scaling may split a shared value; carry its marks to the same effect fields. */
export function carryCardDescriptionMarks(previous: CardDescription, description: CardDescription): CardDescription {
  const identities = new Map<string, CardMagnitude>();
  const marked = new Set<string>();
  for (const part of previous.flatMap((line) => line.parts)) {
    if (typeof part === "string") continue;
    identities.set(magnitudeSignature(part), part);
    if (part.corrupted) for (const reference of part.references) marked.add(referenceKey(reference));
  }
  return description.map((line) => ({
    ...line,
    parts: line.parts.map((part) => {
      if (typeof part === "string") return part;
      const prior = identities.get(magnitudeSignature(part));
      return {
        ...part,
        ...(prior ? { id: prior.id } : {}),
        ...(part.references.some((reference) => marked.has(referenceKey(reference))) ? { corrupted: true } : {}),
      };
    }),
  }));
}

export function renderCardDescription(effects: readonly BattleCardEffect[], description: CardDescription) {
  const magnitudes: RenderedCardMagnitude[] = [];
  const identities = new Map<string, string>();
  const corruptedValuePositions: NonNullable<BattleCard["corruptedValuePositions"]> = [];
  const descriptionLines = description.map(({ parts }, lineIndex) => {
    let line = "";
    for (const part of parts) {
      if (typeof part === "string") {
        line += part;
        continue;
      }
      const value = cardMagnitudeValue(effects, part);
      if (value === null) throw new Error("Card description references inconsistent effect fields");
      const signature = magnitudeSignature(part);
      const previous = identities.get(part.id);
      if (previous !== undefined && previous !== signature)
        throw new Error("Card magnitude identity references different effect fields");
      identities.set(part.id, signature);
      const matchIndex = line.length;
      const text = formatMagnitude(value, part.format);
      magnitudes.push({ id: part.id, magnitude: part, value, lineIndex, matchIndex });
      if (part.corrupted && /^\d/.test(text)) corruptedValuePositions.push({ lineIndex, matchIndex });
      line += text;
    }
    return line;
  });
  return { descriptionLines, magnitudes, corruptedValuePositions };
}

export function withCardDescription(card: BattleCard, description: CardDescription): BattleCard {
  const rendered = renderCardDescription(card.effects, description);
  const { corruptedValuePositions: _previous, ...rest } = card;
  return {
    ...rest,
    description,
    descriptionLines: rendered.descriptionLines,
    ...(rendered.corruptedValuePositions.length ? { corruptedValuePositions: rendered.corruptedValuePositions } : {}),
  };
}

export function mapCardDescriptionReferences(
  description: CardDescription,
  map: (reference: CardMagnitudeReference) => CardMagnitudeReference,
  scope?: string,
): CardDescription {
  return description.map((line) => ({
    ...line,
    parts: line.parts.map((part) =>
      typeof part === "string"
        ? part
        : {
            ...part,
            ...(scope ? { id: `${scope}/${part.id}` } : {}),
            references: part.references.map((reference) =>
              map({ ...reference, ...(reference.effectPath ? { effectPath: [...reference.effectPath] } : {}) }),
            ),
          },
    ),
  }));
}
