import {
  carryCardDescriptionMarks,
  CARD_MAGNITUDE_FIELDS,
  cardMagnitude,
  cardMagnitudeValue,
  createEffectDescription,
  getCardDescription,
  getCardEffect,
  withCardDescription,
  type BattleCard,
  type BattleCardEffect,
  type CardDescription,
  type CardMagnitudeReference,
  type CardMagnitude,
} from "@/lib/game-data";
import { capitalizeWord } from "@/lib/utils";

const magnitudeFields = new Set<string>(CARD_MAGNITUDE_FIELDS);

function referenceMatchesPath(reference: CardMagnitudeReference, path: readonly number[]): boolean {
  return (
    reference.effectIndex === path[0] &&
    (reference.effectPath?.length ?? 0) === path.length - 1 &&
    (reference.effectPath ?? []).every((index, position) => index === path[position + 1])
  );
}

function referencesPath(magnitude: CardMagnitude, path: readonly number[]): boolean {
  return magnitude.references.some((reference) => referenceMatchesPath(reference, path));
}

function magnitudePositions(line: CardDescription[number], path: readonly number[]): number[] {
  return line.parts.flatMap((part, index) => (typeof part !== "string" && referencesPath(part, path) ? [index] : []));
}

function ruleShape(effect: BattleCardEffect | undefined): string {
  return JSON.stringify(
    Object.entries(effect ?? {})
      .filter(([field, value]) => value !== undefined && !magnitudeFields.has(field))
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
}

function rangeRuleClauses(
  card: BattleCard,
  effects: BattleCardEffect[],
  description: CardDescription,
): CardDescription {
  const visit = (source: readonly BattleCardEffect[], prefix: number[] = []) => {
    source.forEach((effect, index) => {
      const path = [...prefix, index];
      const address = { effectIndex: path[0]!, effectPath: path.slice(1) };
      if (effect.kind === "damage" && getCardEffect(effects, address)?.kind === "random-damage") {
        const clauses = createEffectDescription([effect]).filter(
          (line) => line.role === "effect" && line.parts.every((part) => typeof part === "string"),
        );
        if (clauses.length)
          description = description.flatMap((line) => {
            const positions = magnitudePositions(line, path);
            if (!positions.length) return [line];
            if (path.length === 1) return [line, ...clauses];
            const end = positions.at(-1)! + 2;
            return [
              {
                ...line,
                parts: [
                  ...line.parts.slice(0, end),
                  ...clauses.flatMap((clause) => ["; ", ...clause.parts]),
                  ...line.parts.slice(end),
                ],
              },
            ];
          });
      }
      if (effect.kind === "chance") visit([...effect.successEffects, ...effect.failureEffects], path);
    });
  };
  visit(card.effects);
  return description;
}

function signature(line: CardDescription[number]): string {
  return line.parts
    .flatMap((part) => (typeof part === "string" ? [] : part.references))
    .map(
      (reference) =>
        `${reference.effectIndex}/${reference.effectPath?.join("/") ?? ""}/${reference.kind}/${reference.field}/${reference.multiplier ?? 1}`,
    )
    .join("|");
}

function lineFitsEffects(
  line: CardDescription[number],
  before: readonly BattleCardEffect[],
  after: readonly BattleCardEffect[],
): boolean {
  return line.parts.every((part) => {
    if (typeof part === "string") return true;
    // Empty references were already tolerated here; saved descriptions reject them.
    if (part.references.length && cardMagnitudeValue(after, part) === null) return false;
    return part.references.every(
      (reference) => ruleShape(getCardEffect(before, reference)) === ruleShape(getCardEffect(after, reference)),
    );
  });
}

/** Split compressed clauses only when their live values no longer share one literal. */
export function projectCardDescription(card: BattleCard, effects: BattleCardEffect[], rebuild: boolean): BattleCard {
  const previous = getCardDescription(card);
  const fits = (line: CardDescription[number]) => lineFitsEffects(line, card.effects, effects);
  if (!rebuild && previous.every(fits)) return withCardDescription({ ...card, effects }, previous);
  const canonical = rangeRuleClauses(
    card,
    effects,
    createEffectDescription(effects).filter((line) => line.role === "effect"),
  );
  const originals = new Map<string, CardDescription[number]>();
  const unboundEffects: CardDescription = [];
  for (const line of previous) {
    const key = signature(line);
    if (key) originals.set(key, line);
    else if (line.role === "effect") unboundEffects.push(line);
  }
  const description = canonical.map((line) => {
    const original = originals.get(signature(line));
    return original && fits(original) ? original : line;
  });
  // Saved custom prose and ingredient trailers are not replaced by the generic formatter.
  if (unboundEffects.length) {
    const originalCanonical = new Set(createEffectDescription(card.effects).map((line) => JSON.stringify(line.parts)));
    description.push(...unboundEffects.filter((line) => !originalCanonical.has(JSON.stringify(line.parts))));
  }
  description.push(...previous.filter((line) => line.role !== "effect"));
  const marks = previous.map((line) => ({
    ...line,
    parts: line.parts.map((part) =>
      typeof part === "string"
        ? part
        : {
            ...part,
            references: part.references.flatMap((reference): CardMagnitudeReference[] => {
              const next = getCardEffect(effects, reference);
              return reference.kind === "damage" && reference.field === "amount" && next?.kind === "random-damage"
                ? (["minAmount", "maxAmount"] as const).map((field) => ({ ...reference, kind: "random-damage", field }))
                : [reference];
            }),
          },
    ),
  }));
  return withCardDescription({ ...card, effects }, carryCardDescriptionMarks(marks, description));
}

function sourceMagnitude(
  card: BattleCard,
  path: number[],
  field: CardMagnitudeReference["field"],
): CardMagnitude | undefined {
  for (const line of getCardDescription(card)) {
    for (const part of line.parts) {
      if (
        typeof part !== "string" &&
        part.references.some((reference) => reference.field === field && referenceMatchesPath(reference, path))
      )
        return part;
    }
  }
  return undefined;
}

/** Extra effects are read-only display bindings; the source card is never changed or executed. */
export function describeKnownStatusOptions(
  card: BattleCard,
  path: number[],
  amounts: ReadonlyMap<string, number>,
): BattleCard {
  const effects = [...card.effects];
  const effect = getCardEffect(effects, { effectIndex: path[0]!, effectPath: path.slice(1) });
  if (effect?.kind !== "player-status" || !effect.statusPool) return card;
  const parts: CardDescription[number]["parts"] = ["Gain "];
  const statuses = effect.forgeAmount !== undefined ? (["block", "forge", "armor"] as const) : effect.statusPool;
  statuses.forEach((status, index) => {
    if (index) parts.push(index === statuses.length - 1 ? (statuses.length > 2 ? ", or " : " or ") : ", ");
    const source = sourceMagnitude(
      card,
      path,
      status === "forge" && effect.forgeAmount !== undefined ? "forgeAmount" : "amount",
    );
    const effectIndex = effects.length;
    effects.push({ kind: "player-status", status, amount: amounts.get(status)! });
    parts.push(
      cardMagnitude(
        { effectIndex, kind: "player-status", field: "amount" },
        {
          editable: false,
          ...(source?.corrupted !== undefined && { corrupted: source.corrupted }),
          ...(source?.distilled !== undefined && { distilled: source.distilled }),
        },
      ),
      ` ${capitalizeWord(status)}`,
    );
  });
  const description = getCardDescription(card).map((line) => {
    const positions = magnitudePositions(line, path);
    if (!positions.length) return line;
    const first = positions[0]!;
    const start = line.parts[first - 1] === "Gain " ? first - 1 : first;
    return { ...line, parts: [...line.parts.slice(0, start), ...parts, ...line.parts.slice(positions.at(-1)! + 2)] };
  });
  return withCardDescription({ ...card, effects }, description);
}

export function describeKnownConditionalDamage(
  card: BattleCard,
  path: number[],
  amount: number,
  damageType: Extract<BattleCardEffect, { kind: "damage" }>["damageType"],
  condition: "bleeding" | "not-burning",
): BattleCard {
  const source = sourceMagnitude(card, path, "amount");
  const effectIndex = card.effects.length;
  const clause =
    condition === "bleeding" ? "Doubled if the enemy was already Bleeding" : "Tripled if enemy was not Burning";
  const replacement: CardDescription[number]["parts"] = [
    condition === "bleeding" ? "If the enemy was already Bleeding, deal " : "If the enemy was not Burning, deal ",
    cardMagnitude(
      { effectIndex, kind: "damage", field: "amount" },
      {
        editable: false,
        ...(source?.corrupted !== undefined && { corrupted: source.corrupted }),
        ...(source?.distilled !== undefined && { distilled: source.distilled }),
      },
    ),
    ` ${capitalizeWord(damageType)} damage instead (base damage ${condition === "bleeding" ? "doubled" : "tripled"})`,
  ];
  let replaced = false;
  let matchingSource = false;
  const description = getCardDescription(card).map((line) => ({
    ...line,
    parts: line.parts.flatMap((part) => {
      if (typeof part !== "string") matchingSource = referencesPath(part, path);
      if (part !== clause || replaced || !matchingSource) return [part];
      replaced = true;
      return replacement;
    }),
  }));
  return replaced
    ? withCardDescription({ ...card, effects: [...card.effects, { kind: "damage", damageType, amount }] }, description)
    : card;
}
