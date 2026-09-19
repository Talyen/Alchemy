export function targetErrorHandler(item: unknown, error: unknown): { message: string; entry: null };

export function failedMessagesResult(messages: string[], skipLabel: string): { ok: boolean; error?: string };

export function failedResult(
  failures: Array<{ failed: boolean; message: string }>,
  skipLabel: string,
): { ok: boolean; error?: string };
