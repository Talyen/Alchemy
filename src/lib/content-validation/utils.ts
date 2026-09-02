import type { ZodType } from "zod";
import { allGameArt, placeholderCard, placeholderDifficulty, placeholderEnemy } from "@/lib/game-data";
import type { ContentValidationArea, ContentValidationIssue, ContentValidationSeverity } from "./types";

const knownArt = new Set(allGameArt);
const placeholderArt = new Set([placeholderCard, placeholderDifficulty, placeholderEnemy]);

function createIssue(
  severity: ContentValidationSeverity,
  area: ContentValidationArea,
  id: string,
  message: string,
): ContentValidationIssue {
  return { severity, area, id, message };
}

export function createCollector() {
  const issues: ContentValidationIssue[] = [];
  return {
    issues,
    error: (area: ContentValidationArea, id: string, message: string) => {
      issues.push(createIssue("error", area, id, message));
    },
    warning: (area: ContentValidationArea, id: string, message: string) => {
      issues.push(createIssue("warning", area, id, message));
    },
  };
}

function formatZodIssue(issue: { path: ReadonlyArray<string | number | symbol>; message: string }): string {
  const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
  return `${path}${issue.message}`;
}

export function collectSchemaIssues<T>(
  schema: ZodType<T>,
  value: unknown,
  area: ContentValidationArea,
  id: string,
  add: (area: ContentValidationArea, id: string, message: string) => void,
): void {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      add(area, id, formatZodIssue(issue));
    }
  }
}

export function addDuplicateIssues(
  values: readonly string[],
  area: ContentValidationArea,
  label: string,
  add: (area: ContentValidationArea, id: string, message: string) => void,
): void {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  for (const value of duplicates) {
    add(area, value, `Duplicate ${label}: ${value}`);
  }
}

export function validateArt(
  area: ContentValidationArea,
  id: string,
  art: string,
  addError: (area: ContentValidationArea, id: string, message: string) => void,
  addWarning: (area: ContentValidationArea, id: string, message: string) => void,
): void {
  if (!art) {
    addError(area, id, "Missing art reference");
    return;
  }
  if (!knownArt.has(art)) {
    addError("art", id, "Art reference is not in the known optimized asset registries");
  }
  if (placeholderArt.has(art)) {
    addWarning("art", id, "Uses placeholder art");
  }
}
