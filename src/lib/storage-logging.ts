import { logError } from "./error-logger";

export function logStorageFailure(message: string, error?: unknown) {
  if (error instanceof Error) {
    logError(message, "storage", undefined, error.stack, undefined, error);
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-base-to-string -- preserve readable browser storage errors from unknown throws
  logError(message, "storage", error === undefined ? undefined : { error: String(error) });
}
