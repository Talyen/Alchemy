import type { ZodType } from "zod";
import { allGameArt, placeholderCard, placeholderDifficulty, placeholderEnemy } from "@/lib/game-data";
import type { ContentValidationArea, ContentValidationIssue } from "./types";

const knownArt = new Set(allGameArt);
const placeholderArt = new Set([placeholderCard, placeholderDifficulty, placeholderEnemy]);

export function createCollector() {
  const issues: ContentValidationIssue[] = [];
  return {
    issues,
    error: (area: ContentValidationArea, id: string, message: string) => {
      issues.push({ severity: "error", area, id, message });
    },
    warning: (area: ContentValidationArea, id: string, message: string) => {
      issues.push({ severity: "warning", area, id, message });
    },
  };
}

export type Collector = ReturnType<typeof createCollector>;

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
      const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
      add(area, id, `${path}${issue.message}`);
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

function validateArt(
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
    addError(area, id, "Art reference is not in the known optimized asset registries");
  }
  if (placeholderArt.has(art)) {
    addWarning(area, id, "Uses placeholder art");
  }
}

interface LibraryBasicsOptions<T extends { id: string }> {
  area: ContentValidationArea;
  items: readonly T[];
  schema: ZodType;
  titleOf?: (item: T) => string;
  artOf?: (item: T) => string;
  idLabel: string;
}

// Shared duplicate + schema + art triplet for library validators. Bespoke
// checks (offer pools, ability coverage, parity, affix pools) stay inline.
export function validateLibraryBasics<T extends { id: string }>(
  collector: Collector,
  { area, items, schema, titleOf, artOf, idLabel }: LibraryBasicsOptions<T>,
): void {
  addDuplicateIssues(
    items.map((item) => item.id),
    area,
    idLabel,
    collector.error,
  );
  if (titleOf) {
    addDuplicateIssues(
      items.map((item) => titleOf(item)),
      area,
      "title",
      collector.error,
    );
  }
  for (const item of items) {
    collectSchemaIssues(schema, item, area, item.id, collector.error);
    if (artOf) validateArt(area, item.id, artOf(item), collector.error, collector.warning);
  }
}
