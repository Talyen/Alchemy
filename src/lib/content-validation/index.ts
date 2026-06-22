import type { ContentValidationIssue, ContentValidationResult } from "./types";
import { createCollector } from "./utils";
import {
  validateCards,
  validateEnemies,
  validateCompanions,
  validateTrinkets,
  validateKeywordsAndStatuses,
  validateEncounterTraits,
  validateGear,
} from "./validators";

export type { ContentValidationArea } from "./types";

function sortIssues(issues: ContentValidationIssue[]): ContentValidationIssue[] {
  return [...issues].sort(
    (a, b) =>
      a.severity.localeCompare(b.severity) ||
      a.area.localeCompare(b.area) ||
      a.id.localeCompare(b.id) ||
      a.message.localeCompare(b.message),
  );
}

export function runContentValidation(): ContentValidationResult {
  const collector = createCollector();
  validateCards(collector);
  validateEnemies(collector);
  validateCompanions(collector);
  validateTrinkets(collector);
  validateKeywordsAndStatuses(collector);
  validateEncounterTraits(collector);
  validateGear(collector);

  const issues = sortIssues(collector.issues);
  return {
    issues,
    errors: issues.filter((issue) => issue.severity === "error"),
    warnings: issues.filter((issue) => issue.severity === "warning"),
  };
}
