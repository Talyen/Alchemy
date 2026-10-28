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

/** Keep valid entries in their original order and report each dropped position. */
export function parseValidEntries<T>(
  values: readonly unknown[],
  schema: z.ZodType<T>,
  warning?: { path: string; message: string },
): T[] {
  const parsed: T[] = [];
  values.forEach((value, index) => {
    const result = schema.safeParse(value);
    if (result.success) parsed.push(result.data);
    else if (warning) recordNestedValidationWarnings([{ path: `${warning.path}[${index}]`, message: warning.message }]);
  });
  return parsed;
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
  if (!Array.isArray(val)) return [];
  const strings = new Set<string>();
  val.forEach((entry) => {
    if (typeof entry === "string") strings.add(entry);
  });
  return [...strings];
}

export function deduplicatedStringArraySchema() {
  return z.preprocess(deduplicateStrings, z.array(z.string())).catch([]);
}

/** Drop damaged entries without changing the order or multiplicity of valid IDs. */
export function savedStringArraySchema() {
  return z
    .array(z.unknown())
    .transform((values) => values.filter((value): value is string => typeof value === "string"));
}

export function deduplicateFromSet<T extends string>(val: unknown, validIds: ReadonlySet<T> | readonly T[]): T[] {
  if (!Array.isArray(val)) return [];
  const set: ReadonlySet<string> = validIds instanceof Set ? validIds : new Set<string>(validIds);
  const result = new Set<T>();
  for (const id of val) {
    if (typeof id === "string" && set.has(id)) result.add(id as T);
  }
  return [...result];
}

export function toFiniteNonNegativeInt(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
}

export function toSafeNonNegativeInt(value: unknown): number | null {
  const integer = toFiniteNonNegativeInt(value);
  return integer !== null && Number.isSafeInteger(integer) ? integer : null;
}

export function isUsableLiveCombatGold(value: unknown): value is number {
  return typeof value === "number" && value >= 0 && Number.isSafeInteger(Math.floor(value));
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
