import { z } from "zod";

export interface ValidationError {
  path: string;
  message: string;
}

// Per-card repair notes (e.g. dropped effects) are recorded against the parsed
// card object itself instead of a module-global collector, so nested parses
// (parked runs inside a save) cannot clobber each other. Entries are held
// weakly and collected by traversing the successful parse result.
const nestedWarnings = new WeakMap<object, ValidationError[]>();

export function recordNestedValidationWarnings(target: object, errors: ValidationError[]): void {
  if (errors.length === 0) return;
  const existing = nestedWarnings.get(target);
  if (existing) existing.push(...errors);
  else nestedWarnings.set(target, [...errors]);
}

function collectNestedValidationWarnings(root: unknown): ValidationError[] {
  const collected: ValidationError[] = [];
  const seen = new Set<object>();
  const visit = (value: unknown): void => {
    if (!value || typeof value !== "object") return;
    const node: object = value;
    if (seen.has(node)) return;
    seen.add(node);
    const warnings = nestedWarnings.get(node);
    if (warnings) collected.push(...warnings);
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    for (const entry of Object.values(value as Record<string, unknown>)) visit(entry);
  };
  visit(root);
  return collected;
}

export function safeParseWithErrors<T>(
  schema: z.ZodType<T>,
  data: unknown,
):
  | { success: true; data: T; errors: ValidationError[] }
  | { success: false; error: z.ZodError; errors: ValidationError[] } {
  const result = schema.safeParse(data);
  if (result.success) return { success: true, data: result.data, errors: collectNestedValidationWarnings(result.data) };
  const zodErrors: ValidationError[] = result.error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
  return { success: false, error: result.error, errors: zodErrors };
}

export function deduplicateStrings(val: unknown): string[] {
  return Array.isArray(val) ? [...new Set(val.filter((v): v is string => typeof v === "string"))] : [];
}

export function deduplicatedStringArraySchema() {
  return z.preprocess(deduplicateStrings, z.array(z.string())).catch([]);
}
