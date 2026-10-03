import { z } from "zod";

export interface ValidationError {
  path: string;
  message: string;
}

// Per-card repair notes (e.g. dropped effects) are collected in a sink scoped
// to the enclosing safeParseWithErrors call, so sibling cards in one save
// cannot clobber each other and successful parses never pay for a full-save
// traversal to recover warnings.
let activeWarningSink: ValidationError[] | null = null;

export function recordNestedValidationWarnings(errors: ValidationError[]): void {
  if (errors.length === 0 || !activeWarningSink) return;
  activeWarningSink.push(...errors);
}

export function safeParseWithErrors<T>(
  schema: z.ZodType<T>,
  data: unknown,
):
  | { success: true; data: T; errors: ValidationError[] }
  | { success: false; error: z.ZodError; errors: ValidationError[] } {
  const previousSink = activeWarningSink;
  const collected: ValidationError[] = [];
  activeWarningSink = collected;
  try {
    const result = schema.safeParse(data);
    if (result.success) return { success: true, data: result.data, errors: collected };
    const zodErrors: ValidationError[] = result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    return { success: false, error: result.error, errors: zodErrors };
  } finally {
    activeWarningSink = previousSink;
  }
}

export function deduplicateStrings(val: unknown): string[] {
  return Array.isArray(val) ? [...new Set(val.filter((entry): entry is string => typeof entry === "string"))] : [];
}

export function deduplicatedStringArraySchema() {
  return z.preprocess(deduplicateStrings, z.array(z.string())).catch([]);
}

export function deduplicateFromSet<T extends string>(val: unknown, validIds: ReadonlySet<T> | readonly T[]): T[] {
  const set: ReadonlySet<string> = validIds instanceof Set ? validIds : new Set<string>(validIds);
  return deduplicateStrings(val).filter((id): id is T => set.has(id));
}

export function toFiniteNonNegativeInt(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
}

export function isUsableLiveCombatGold(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function deduplicatedSetArraySchema<T extends string>(
  validIds: ReadonlySet<T> | readonly T[],
  itemSchema?: z.ZodType<T>,
) {
  return z
    .preprocess(
      (val) => deduplicateFromSet(val, validIds),
      z.array(itemSchema ?? z.custom<T>((val) => typeof val === "string")),
    )
    .catch([]);
}
