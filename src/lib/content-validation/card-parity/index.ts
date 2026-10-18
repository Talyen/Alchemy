import { describeCardEffects, visitBattleCardEffects, type BattleCard } from "@/lib/game-data";
import { MIXED_POTION_CARD_ID } from "@/lib/game-constants";
import { capitalizeWord } from "@/lib/utils";
import type { ContentValidationIssue } from "../types";

export { TRAIT_REQUIRED_TERMS } from "./enemy-trait-parity";
export { validateTrinketDescriptionParity } from "./trinket-parity";

function cardIssue(severity: "error" | "warning", id: string, message: string): ContentValidationIssue {
  return { severity, area: "cards", id, message };
}

// Tag-like lines carry no numeric mechanic and stay warnings-only, matching
// the previous checker: a missing Leech/Archery/Consume/Companion line never
// errors, it warns. Mechanic comparison ignores them on both sides, so the
// expected lines stay exactly what describeCardEffects returns.
function isTagLine(card: BattleCard, line: string): boolean {
  if (line === "Leech" || line === "Consume" || line === "Companion") return true;
  return card.tags?.some((tag) => capitalizeWord(tag) === line) ?? false;
}

function checkTagWarnings(card: BattleCard): ContentValidationIssue[] {
  const warnings: ContentValidationIssue[] = [];
  let summon = false;
  let leech = false;
  visitBattleCardEffects(card.effects, (effect) => {
    if (effect.kind === "summon-companion") summon = true;
    if ("lifesteal" in effect && effect.lifesteal) leech = true;
  });
  if (leech && !card.descriptionLines.some((line) => /\bLeech\b/.test(line)))
    warnings.push(cardIssue("warning", card.id, "Lifesteal effect is missing Leech description line"));
  const hasArcheryTag = card.tags?.includes("archery") === true;
  const hasArcheryLine = card.descriptionLines.some((line) => line === "Archery");
  if (hasArcheryTag !== hasArcheryLine)
    warnings.push(
      cardIssue(
        "warning",
        card.id,
        hasArcheryTag
          ? "Archery tag is missing Archery description line"
          : "Archery description line is missing archery tag",
      ),
    );
  if (card.consume === true) {
    const hasConsume = card.descriptionLines.some((line) => line === "Consume");
    const hasCompanion = summon && card.descriptionLines.some((line) => line === "Companion");
    if (!hasConsume && !hasCompanion)
      warnings.push(cardIssue("warning", card.id, "consume:true is missing Consume or Companion description line"));
  }
  if (summon && !card.descriptionLines.some((line) => line.includes("Companion")))
    warnings.push(cardIssue("warning", card.id, "summon-companion effect is missing Companion description line"));
  return warnings;
}

// The catalog's Steal wording is a flavor alias for the canonical Gain gold
// line. Player-visible text stays untouched; only the checker normalizes.
function normalizeAlias(line: string): string {
  return line.replace(/^Steals? /, "Gain ");
}

function diffMechanicLines(card: BattleCard, expectedMechanic: string[]): ContentValidationIssue[] {
  const actualMechanic = card.descriptionLines.filter((line) => !isTagLine(card, line));
  const expectedNormalized = expectedMechanic.filter((line) => !isTagLine(card, line));
  const issues: ContentValidationIssue[] = [];
  const count = Math.max(actualMechanic.length, expectedNormalized.length);
  for (let index = 0; index < count; index += 1) {
    const actual = actualMechanic[index];
    const expected = expectedNormalized[index];
    if (actual === undefined && expected !== undefined) {
      issues.push(cardIssue("error", card.id, `missing expected description line "${expected}"`));
    } else if (expected === undefined && actual !== undefined) {
      issues.push(cardIssue("error", card.id, `"${actual}" has no matching effect`));
    } else if (actual !== undefined && expected !== undefined && normalizeAlias(actual) !== normalizeAlias(expected)) {
      issues.push(cardIssue("error", card.id, `"${actual}" does not match expected "${expected}"`));
    }
  }
  return issues;
}

export function validateCardDescriptionParity(card: BattleCard): ContentValidationIssue[] {
  const warnings = checkTagWarnings(card);
  if (card.id === MIXED_POTION_CARD_ID) return warnings;
  let expected: string[];
  try {
    expected = describeCardEffects(card.effects);
  } catch {
    return [...warnings, cardIssue("error", card.id, "Cannot describe card effects")];
  }
  return [...warnings, ...diffMechanicLines(card, expected)];
}
