// Save validation utilities: error collection stack, caught() preprocessors, string dedup.
import { z } from "zod";
import { logError } from "@/lib/error-logger";

export interface ValidationError {
  path: string;
  message: string;
}

class ErrorCollectorStack {
  private stack: ValidationError[][] = [];

  push(collector: ValidationError[]): void {
    this.stack.push(collector);
  }

  pop(): void {
    this.stack.pop();
  }

  current(): ValidationError[] | undefined {
    return this.stack[this.stack.length - 1];
  }
}

const errorCollectorStack = new ErrorCollectorStack();

export function pushValidationError(path: string, message: string): void {
  errorCollectorStack.current()?.push({ path, message });
}

export function safeParseWithErrors<T>(
  schema: z.ZodType<T>,
  data: unknown,
):
  | { success: true; data: T; errors: ValidationError[] }
  | { success: false; error: z.ZodError; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  errorCollectorStack.push(errors);
  try {
    const result = schema.safeParse(data);
    return result.success
      ? { success: true, data: result.data, errors }
      : { success: false, error: result.error, errors };
  } finally {
    errorCollectorStack.pop();
  }
}

export function caught<T>(schema: z.ZodType<T>, fallback: T, path: string): z.ZodType<T> {
  return z.preprocess((val) => {
    if (val == null) return fallback;
    const result = schema.safeParse(val);
    if (!result.success) {
      pushValidationError(path, result.error.message);
      logError(`[Save Validation] Field "${path}" invalid, fell back to default`, "validation", {
        field: path,
        error: result.error.message,
      });
      return fallback;
    }
    return result.data;
  }, schema);
}

export function deduplicateStrings(val: unknown): string[] {
  return Array.isArray(val) ? [...new Set(val.filter((v): v is string => typeof v === "string"))] : [];
}

export function deduplicatedStringArraySchema(path: string) {
  return caught(z.preprocess(deduplicateStrings, z.array(z.string())), [], path);
}
