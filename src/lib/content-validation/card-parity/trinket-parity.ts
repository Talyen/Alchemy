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
  if (!canonical) {
    addIssue(`Trinket "${trinket.id}" has no registered description definition`);
    return issues;
  }
  const expected = describeTrinket(trinket.id, trinket.effects);
  if (expected === null) {
    addIssue(`Trinket "${trinket.id}" has no registered description definition`);
    return issues;
  }

  // One pass over the union of effect keys keeps missing/unexpected/boolean
  // reports together; a missing boolean key still reports both, as before.
  const canonicalEffects = canonical.effects as Record<string, unknown>;
  const entryEffects = trinket.effects as Record<string, unknown>;
  for (const key of new Set([...Object.keys(canonicalEffects), ...Object.keys(entryEffects)])) {
    if (!Object.hasOwn(entryEffects, key)) addIssue(`Missing required effect: ${key}`);
    if (!Object.hasOwn(canonicalEffects, key)) addIssue(`Unexpected effect: ${key}`);
    else if (typeof canonicalEffects[key] === "boolean" && entryEffects[key] !== canonicalEffects[key])
      addIssue(`Effect ${key} must be ${String(canonicalEffects[key])}`);
  }

  if (normalizeProse(trinket.descriptionLines.join(" ")) !== normalizeProse(expected)) {
    addIssue(`Trinket "${trinket.id}" description does not match its required trigger and outcome: "${expected}"`);
  }
  return issues;
}
