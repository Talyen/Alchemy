import { buildDescriptionMessage } from "./description-message";
import type { BattleCard, BattleCardEffect } from "./types";

export interface CardEffectAddress {
  effectIndex: number;
  effectPath?: number[];
}

export const CARD_MAGNITUDE_FIELDS = [
  "amount",
  "forgeAmount",
  "amountIfTargetFrozen",
  "minAmount",
  "maxAmount",
  "perManaCrystal",
  "convertCurrentMana",
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
  distilled?: boolean;
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
  const path = reference.effectPath?.length ? `/${reference.effectPath.join("/")}` : "";
  const id = `${reference.effectIndex}${path}:${reference.field}`;
  return { kind: "magnitude", id, references: [reference, ...shared], ...format };
}

export function getCardEffect(
  effects: readonly BattleCardEffect[],
  address: CardEffectAddress,
): BattleCardEffect | undefined {
  let effect = effects[address.effectIndex];
  for (const index of address.effectPath ?? []) {
    if (!Number.isInteger(index) || index < 0) return undefined;
    if (effect?.kind === "chance")
      effect =
        index < effect.successEffects.length
          ? effect.successEffects[index]
          : effect.failureEffects[index - effect.successEffects.length];
    else if (effect?.kind === "repeat-over-turns") effect = effect.effects[index];
    else return undefined;
  }
  return effect;
}

export function cardMagnitudeValue(effects: readonly BattleCardEffect[], magnitude: CardMagnitude): number | null {
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
}

function referenceKey(reference: CardMagnitudeReference): string {
  return `${reference.kind}/${reference.effectIndex}/${reference.effectPath?.join("/") ?? ""}/${reference.field}`;
}

function magnitudeSignature(magnitude: CardMagnitude): string {
  if (magnitude.references.length === 1) {
    const reference = magnitude.references[0]!;
    return `${referenceKey(reference)}/${reference.multiplier ?? 1}`;
  }
  return magnitude.references.map((reference) => `${referenceKey(reference)}/${reference.multiplier ?? 1}`).join("|");
}

/** Scaling may split a shared value; carry its marks to the same effect fields. */
export function carryCardDescriptionMarks(previous: CardDescription, description: CardDescription): CardDescription {
  const identities = new Map<string, CardMagnitude>();
  const marked = new Set<string>();
  const distilled = new Set<string>();
  for (const line of previous) {
    for (const part of line.parts) {
      if (typeof part === "string") continue;
      identities.set(magnitudeSignature(part), part);
      if (part.corrupted || part.distilled) {
        for (const reference of part.references) {
          const key = referenceKey(reference);
          if (part.corrupted) marked.add(key);
          if (part.distilled) distilled.add(key);
        }
      }
    }
  }
  return description.map((line) => ({
    ...line,
    parts: line.parts.map((part) => {
      if (typeof part === "string") return part;
      const prior = identities.get(magnitudeSignature(part));
      let corrupted = false;
      let isDistilled = false;
      if (marked.size || distilled.size) {
        for (const reference of part.references) {
          const key = referenceKey(reference);
          corrupted ||= marked.has(key);
          isDistilled ||= distilled.has(key);
          if (corrupted && isDistilled) break;
        }
      }
      return {
        ...part,
        ...(prior ? { id: prior.id } : {}),
        ...(corrupted ? { corrupted: true } : {}),
        ...(isDistilled ? { distilled: true } : {}),
      };
    }),
  }));
}

export function renderCardDescription(effects: readonly BattleCardEffect[], description: CardDescription) {
  const magnitudes: RenderedCardMagnitude[] = [];
  const identities = new Map<string, CardMagnitude>();
  type MessagePart = Parameters<typeof buildDescriptionMessage>[0][number];
  const localizedParts: Array<Array<string | MessagePart>> = [];
  const descriptionLines = description.map(({ parts }, lineIndex) => {
    const messageParts: Array<string | MessagePart> = [];
    let line = "";
    for (const part of parts) {
      if (typeof part === "string") {
        messageParts.push(part);
        line += part;
        continue;
      }
      const value = cardMagnitudeValue(effects, part);
      if (value === null) throw new Error("Card description references inconsistent effect fields");
      const previous = identities.get(part.id);
      // Most IDs occur once. Build signatures only when an ID is reused.
      if (previous !== undefined && magnitudeSignature(previous) !== magnitudeSignature(part))
        throw new Error("Card magnitude identity references different effect fields");
      identities.set(part.id, part);
      const text = formatMagnitude(value, part.format);
      messageParts.push({ text, magnitudeId: part.id });
      magnitudes.push({ id: part.id, magnitude: part, value, lineIndex });
      line += text;
    }
    localizedParts.push(messageParts);
    return line;
  });
  let localizedLines: Array<ReturnType<typeof buildDescriptionMessage>> | undefined;
  return {
    descriptionLines,
    magnitudes,
    get localizedLines() {
      return (localizedLines ??= localizedParts.map((parts) =>
        buildDescriptionMessage(parts.map((part) => (typeof part === "string" ? { text: part } : part))),
      ));
    },
  };
}

export function withCardDescription(card: BattleCard, description: CardDescription): BattleCard {
  const rendered = renderCardDescription(card.effects, description);
  return {
    ...card,
    description: mapCardDescriptionReferences(description, (reference) => reference),
    descriptionLines: rendered.descriptionLines,
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
