import { z } from "zod";

export interface ValidationError {
  path: string;
  message: string;
}

let currentCollector: ValidationError[] | null = null;

export function pushValidationError(path: string, message: string): void {
  currentCollector?.push({ path, message });
}

export function safeParseWithErrors<T>(
  schema: z.ZodType<T>,
  data: unknown,
):
  | { success: true; data: T; errors: ValidationError[] }
  | { success: false; error: z.ZodError; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  currentCollector = errors;
  try {
    const result = schema.safeParse(data);
    if (result.success) return { success: true, data: result.data, errors };
    const zodErrors: ValidationError[] = result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    return { success: false, error: result.error, errors: [...errors, ...zodErrors] };
  } finally {
    currentCollector = null;
  }
}

export function deduplicateStrings(val: unknown): string[] {
  return Array.isArray(val) ? [...new Set(val.filter((v): v is string => typeof v === "string"))] : [];
}

export function deduplicatedStringArraySchema() {
  return z.preprocess(deduplicateStrings, z.array(z.string())).catch([]);
}
