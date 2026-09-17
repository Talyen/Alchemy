import { logError } from "./error-logger";

function toLoggableStorageDetail(error: object): string {
  const candidate = error as { name?: unknown; message?: unknown };
  const name = typeof candidate.name === "string" ? candidate.name : "";
  const message = typeof candidate.message === "string" ? candidate.message : "";
  const labeled = [name, message].filter(Boolean).join(": ");
  if (labeled) return labeled;
  try {
    const serialized = JSON.stringify(error);
    if (serialized !== undefined && serialized !== "{}") return serialized;
  } catch {
    // Fall through to the object tag below.
  }
  return Object.prototype.toString.call(error);
}

export function logStorageFailure(message: string, error?: unknown) {
  // Call without `error` only for observed failures that carry no exception
  // (e.g. a backend returning { ok: false } or a non-object save root).
  // Routine skips — missing, empty, or below-baseline candidates on fresh
  // profiles — stay silent instead: never call this for them, because browser
  // journeys assert zero runtime errors (see MIGRATIONS.md load selection).
  if (error instanceof Error) {
    logError(message, "storage", undefined, error.stack, undefined, error);
    return;
  }
  if (error === undefined) {
    logError(message, "storage", undefined);
    return;
  }
  // Preserve readable browser storage errors from unknown throws (e.g.
  // DOMException quota errors, which are not instanceof Error and serialize
  // to {}). Narrowed before string conversion so no-base-to-string stays clean.
  if (typeof error === "string") {
    logError(message, "storage", { error });
    return;
  }
  if (typeof error === "number" || typeof error === "boolean" || typeof error === "bigint") {
    logError(message, "storage", { error: `${error}` });
    return;
  }
  if (typeof error === "object" && error !== null) {
    logError(message, "storage", { error: toLoggableStorageDetail(error) });
    return;
  }
  logError(message, "storage", { error: Object.prototype.toString.call(error) });
}
