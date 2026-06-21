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

export type ContentValidationIssue = {
  severity: ContentValidationSeverity;
  area: ContentValidationArea;
  id: string;
  message: string;
};

export type ContentValidationResult = {
  issues: ContentValidationIssue[];
  errors: ContentValidationIssue[];
  warnings: ContentValidationIssue[];
};
