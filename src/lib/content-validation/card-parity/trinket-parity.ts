import { describeTrinket, trinketById, type TrinketEntry } from "@/lib/game-data";
import type { ContentValidationIssue } from "../types";

function normalizeProse(prose: string): string {
  return prose.toLowerCase().replace(/\s+/g, " ").trim();
}

export function validateTrinketDescriptionParity(trinket: TrinketEntry): ContentValidationIssue[] {
  const issues: ContentValidationIssue[] = [];
  const addIssue = (message: string) => {
    issues.push({ severity: "error", area: "trinkets", id: trinket.id, message });
  };
  const canonical = trinketById[trinket.id];
  const expected = describeTrinket(trinket.id, trinket.effects);
  if (!canonical || expected === null) {
    addIssue(`Trinket "${trinket.id}" has no registered description definition`);
    return issues;
  }

  for (const [key, value] of Object.entries(canonical.effects)) {
    if (!Object.hasOwn(trinket.effects, key)) addIssue(`Missing required effect: ${key}`);
    if (typeof value === "boolean" && trinket.effects[key as keyof typeof trinket.effects] !== value)
      addIssue(`Effect ${key} must be ${String(value)}`);
  }
  for (const key of Object.keys(trinket.effects)) {
    if (!Object.hasOwn(canonical.effects, key)) addIssue(`Unexpected effect: ${key}`);
  }

  if (normalizeProse(trinket.descriptionLines.join(" ")) !== normalizeProse(expected)) {
    addIssue(`Trinket "${trinket.id}" description does not match its required trigger and outcome: "${expected}"`);
  }
  return issues;
}
