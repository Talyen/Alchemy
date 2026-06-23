export type ContentValidationSeverity = "error" | "warning";
export type ContentValidationArea =
  | "art"
  | "balance"
  | "cards"
  | "companions"
  | "encounter-traits"
  | "enemies"
  | "gear"
  | "keywords"
  | "rewards"
  | "statuses"
  | "trinkets";

export interface ContentValidationIssue {
  severity: ContentValidationSeverity;
  area: ContentValidationArea;
  id: string;
  message: string;
}

export interface ContentValidationResult {
  issues: ContentValidationIssue[];
  errors: ContentValidationIssue[];
  warnings: ContentValidationIssue[];
}
