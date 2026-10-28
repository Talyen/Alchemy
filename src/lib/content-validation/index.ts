import type { ContentValidationIssue, ContentValidationResult } from "./types";
import { createCollector } from "./utils";
import { validateTalents, validateKeywordsAndStatuses, validateEncounterTraits } from "./validators";
import { validateCards, validateTrinkets } from "./validators-cards";
import { validateEnemies, validateCompanions } from "./validators-enemies";
import { validateGear } from "./validators-gear";
import { validateTypography } from "./validators-typography";

export type { ContentValidationResult } from "./types";

const SEVERITY_RANK: Record<ContentValidationIssue["severity"], number> = {
  error: 0,
  warning: 1,
};

function sortIssues(issues: ContentValidationIssue[]): ContentValidationIssue[] {
  return [...issues].sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
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
  validateTalents(collector);
  validateKeywordsAndStatuses(collector);
  validateEncounterTraits(collector);
  validateGear(collector);
  validateTypography(collector);

  const issues = sortIssues(collector.issues);
  const errors: ContentValidationIssue[] = [];
  const warnings: ContentValidationIssue[] = [];
  for (const issue of issues) (issue.severity === "error" ? errors : warnings).push(issue);
  return { issues, errors, warnings };
}
