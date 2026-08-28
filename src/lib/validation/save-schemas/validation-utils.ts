import { z } from "zod";

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

export function deduplicateStrings(val: unknown): string[] {
  return Array.isArray(val) ? [...new Set(val.filter((v): v is string => typeof v === "string"))] : [];
}

export function deduplicatedStringArraySchema() {
  return z.preprocess(deduplicateStrings, z.array(z.string())).catch([]);
}
