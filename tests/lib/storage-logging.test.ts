import { afterEach, expect, it, vi } from "vitest";
import { registerErrorSink, resetErrorSinksForTests } from "@/lib/error-logger";
import { logStorageFailure } from "@/lib/storage-logging";

afterEach(() => {
  resetErrorSinksForTests();
  vi.restoreAllMocks();
});

it("preserves cross-realm quota diagnostics and survives circular thrown objects", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const sink = vi.fn();
  registerErrorSink(sink);
  const circular: { self?: unknown } = {};
  circular.self = circular;
  logStorageFailure("Save rejected", { name: "QuotaExceededError", message: "Disk full" });
  logStorageFailure("Save rejected", circular);
  expect(sink.mock.calls.map(([entry]) => entry.context)).toEqual([
    { error: "QuotaExceededError: Disk full" },
    { error: "[object Object]" },
  ]);
});
