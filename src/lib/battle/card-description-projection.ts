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
    (!reference.effectPath || reference.effectPath.every((index, position) => index === path[position + 1]))
  );
}

function referencesPath(magnitude: CardMagnitude, path: readonly number[]): boolean {
  return magnitude.references.some((reference) => referenceMatchesPath(reference, path));
}

function magnitudePositions(line: CardDescription[number], path: readonly number[]): number[] {
  const positions: number[] = [];
  line.parts.forEach((part, index) => {
    if (typeof part !== "string" && referencesPath(part, path)) positions.push(index);
  });
  return positions;
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
  const visit = (source: readonly BattleCardEffect[], prefix: number[] = [], offset = 0) => {
    source.forEach((effect, index) => {
      const path = [...prefix, index + offset];
      if (
        effect.kind === "damage" &&
        getCardEffect(effects, { effectIndex: path[0]!, effectPath: path.slice(1) })?.kind === "random-damage"
      ) {
        const clauses = createEffectDescription([effect]).filter(
          (line) => line.role === "effect" && line.parts.every((part) => typeof part === "string"),
        );
        if (clauses.length) {
          let inlineClauses: CardDescription[number]["parts"] | undefined;
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
                  ...(inlineClauses ??= clauses.flatMap((clause) => ["; ", ...clause.parts])),
                  ...line.parts.slice(end),
                ],
              },
            ];
          });
        }
      }
      if (effect.kind === "chance") {
        visit(effect.successEffects, path);
        visit(effect.failureEffects, path, effect.successEffects.length);
      }
    });
  };
  visit(card.effects);
  return description;
}

function signature(line: CardDescription[number]): string {
  const references: string[] = [];
  for (const part of line.parts) {
    if (typeof part === "string") continue;
    for (const reference of part.references) {
      references.push(
        `${reference.effectIndex}/${reference.effectPath?.join("/") ?? ""}/${reference.kind}/${reference.field}/${reference.multiplier ?? 1}`,
      );
    }
  }
  return references.join("|");
}

function lineFitsEffects(
  line: CardDescription[number],
  before: readonly BattleCardEffect[],
  after: readonly BattleCardEffect[],
  shape: (effect: BattleCardEffect | undefined) => string,
): boolean {
  return line.parts.every((part) => {
    if (typeof part === "string") return true;
    // Empty references were already tolerated here; saved descriptions reject them.
    if (part.references.length && cardMagnitudeValue(after, part) === null) return false;
    return part.references.every((reference) => {
      const original = getCardEffect(before, reference);
      const projected = getCardEffect(after, reference);
      return original === projected || shape(original) === shape(projected);
    });
  });
}

/** Split compressed clauses only when their live values no longer share one literal. */
export function projectCardDescription(card: BattleCard, effects: BattleCardEffect[], rebuild: boolean): BattleCard {
  const previous = getCardDescription(card);
  let shapes: Map<BattleCardEffect | undefined, string> | undefined;
  const shape = (effect: BattleCardEffect | undefined) => {
    const cache = (shapes ??= new Map<BattleCardEffect | undefined, string>());
    let value = cache.get(effect);
    if (value === undefined) {
      value = ruleShape(effect);
      cache.set(effect, value);
    }
    return value;
  };
  const fits = (line: CardDescription[number]) => lineFitsEffects(line, card.effects, effects, shape);
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
    const originalCanonical = new Set<string>();
    for (const line of createEffectDescription(card.effects)) originalCanonical.add(JSON.stringify(line.parts));
    for (const line of unboundEffects) {
      if (!originalCanonical.has(JSON.stringify(line.parts))) description.push(line);
    }
  }
  for (const line of previous) if (line.role !== "effect") description.push(line);
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
  description: CardDescription,
  path: number[],
  field: CardMagnitudeReference["field"],
): CardMagnitude | undefined {
  for (const line of description) {
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
  const effect = getCardEffect(card.effects, { effectIndex: path[0]!, effectPath: path.slice(1) });
  if (effect?.kind !== "player-status" || !effect.statusPool) return card;
  const effects = [...card.effects];
  const parts: CardDescription[number]["parts"] = ["Gain "];
  const previous = getCardDescription(card);
  const statuses = effect.forgeAmount !== undefined ? (["block", "forge", "armor"] as const) : effect.statusPool;
  const amountSource = statuses.length ? sourceMagnitude(previous, path, "amount") : undefined;
  const forgeSource = effect.forgeAmount !== undefined ? sourceMagnitude(previous, path, "forgeAmount") : undefined;
  statuses.forEach((status, index) => {
    if (index) parts.push(index === statuses.length - 1 ? (statuses.length > 2 ? ", or " : " or ") : ", ");
    const source = status === "forge" && effect.forgeAmount !== undefined ? forgeSource : amountSource;
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
  const description = previous.map((line) => {
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
  const previous = getCardDescription(card);
  const source = sourceMagnitude(previous, path, "amount");
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
  const description = previous.map((line) => ({
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

/** Keep the Forge formula intact and bind its current total only in the inspection view. */
export function describeKnownForgeDamageTotal(
  card: BattleCard,
  path: number[],
  amount: number,
  damageType: Extract<BattleCardEffect, { kind: "damage" }>["damageType"],
): BattleCard {
  const effect = getCardEffect(card.effects, { effectIndex: path[0]!, effectPath: path.slice(1) });
  if (effect?.kind !== "damage" || effect.forgeBonusPercent === undefined) return card;
  const canonical = createEffectDescription([effect])[0];
  const magnitudeIndex = canonical?.parts.findIndex((part) => typeof part !== "string") ?? -1;
  const tail = canonical?.parts.slice(magnitudeIndex + 1);
  if (magnitudeIndex < 0 || !tail?.length || !tail.every((part) => typeof part === "string")) return card;
  const clause = tail.join("");
  let bound = false;
  const description = getCardDescription(card).map((line) => ({
    ...line,
    parts: line.parts.flatMap((part, index) => {
      const previous = line.parts[index - 1];
      if (
        typeof part !== "string" ||
        typeof previous !== "object" ||
        !referencesPath(previous, path) ||
        !part.startsWith(clause)
      )
        return [part];
      bound = true;
      return [
        `${clause} (`,
        cardMagnitude({ effectIndex: card.effects.length, kind: "damage", field: "amount" }, { editable: false }),
        ` total)${part.slice(clause.length)}`,
      ];
    }),
  }));
  return bound
    ? withCardDescription({ ...card, effects: [...card.effects, { kind: "damage", damageType, amount }] }, description)
    : card;
}

/** Bind a known paid hit without replacing the authored resource-spending rule. */
export function describeKnownBlockSpendDamage(
  card: BattleCard,
  known: ReadonlyMap<
    string,
    { amount: number; damageType: Extract<BattleCardEffect, { kind: "damage" }>["damageType"] }
  >,
): BattleCard {
  if (!known.size) return card;
  const clauses = new Map<
    string,
    Array<{ amount: number; damageType: Extract<BattleCardEffect, { kind: "damage" }>["damageType"] } | undefined>
  >();
  const visit = (effects: readonly BattleCardEffect[], prefix: number[] = [], offset = 0) => {
    effects.forEach((effect, index) => {
      const path = [...prefix, index + offset];
      if (effect.kind === "damage" && effect.equalToBlock && effect.spendBlock) {
        const clause = createEffectDescription([effect])[0]?.parts[0];
        if (typeof clause === "string") {
          const queue = clauses.get(clause) ?? [];
          queue.push(known.get(path.join(".")));
          clauses.set(clause, queue);
        }
      }
      if (effect.kind === "chance") {
        visit(effect.successEffects, path);
        visit(effect.failureEffects, path, effect.successEffects.length);
      } else if (effect.kind === "repeat-over-turns") visit(effect.effects, path);
    });
  };
  visit(card.effects);
  const effects = [...card.effects];
  const description = getCardDescription(card).map((line) => {
    let parts = line.parts;
    for (const [clause, queue] of clauses) {
      parts = parts.flatMap((part) => {
        if (typeof part !== "string" || !part.includes(clause)) return [part];
        const pieces = part.split(clause);
        const replacement: typeof parts = [pieces[0]!];
        for (const piece of pieces.slice(1)) {
          const hit = queue.shift();
          if (hit) {
            const effectIndex = effects.length;
            effects.push({ kind: "damage", damageType: hit.damageType, amount: hit.amount });
            replacement.push(
              clause.slice(0, clause.indexOf("to deal ") + "to deal ".length),
              cardMagnitude({ effectIndex, kind: "damage", field: "amount" }, { editable: false }),
              ` ${capitalizeWord(hit.damageType)} damage`,
            );
          } else replacement.push(clause);
          replacement.push(piece);
        }
        return replacement;
      });
    }
    return { ...line, parts };
  });
  return effects.length === card.effects.length ? card : withCardDescription({ ...card, effects }, description);
}
