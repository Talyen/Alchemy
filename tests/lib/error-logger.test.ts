import { afterEach, expect, it, vi } from "vitest";
import { logError, registerErrorSink, resetErrorSinksForTests } from "@/lib/error-logger";

afterEach(() => {
  resetErrorSinksForTests();
  vi.restoreAllMocks();
});

it("still delivers failures to healthy sinks when the console and another sink throw", () => {
  vi.spyOn(console, "error").mockImplementation(() => {
    throw new Error("Console adapter unavailable");
  });
  registerErrorSink(() => {
    throw new Error("Storage full");
  });
  const healthy = vi.fn();
  registerErrorSink(healthy);
  const cause = new Error("Save failed");
  logError("Save failed", "storage", { slot: "active" }, cause.stack, undefined, cause);
  logError("Next failure", "battle");

  expect(healthy.mock.calls.map(([entry]) => entry.message)).toEqual(["Save failed", "Next failure"]);
  expect(healthy.mock.calls[0]?.[0]).toMatchObject({ source: "storage", context: { slot: "active" }, cause });
});

it("drops recursive sink failures without suppressing the next independent error", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const healthy = vi.fn();
  registerErrorSink(() => logError("Recursive error", "other"));
  registerErrorSink(healthy);
  logError("First", "storage");
  logError("Second", "battle");
  expect(healthy.mock.calls.map(([entry]) => entry.message)).toEqual(["First", "Second"]);
});

it("unsubscribes only its own registration when consumers share a sink", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const shared = vi.fn();
  const first = registerErrorSink(shared);
  const second = registerErrorSink(shared);
  first();
  first();
  logError("Still subscribed", "storage");
  expect(shared).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ message: "Still subscribed" }));
  second();
  logError("Unsubscribed", "storage");
  expect(shared).toHaveBeenCalledOnce();
});

it("delivers the current error to a stable subscriber snapshot when sinks change during reporting", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const removed = vi.fn();
  const added = vi.fn();
  let unsubscribe = () => {};
  registerErrorSink(() => {
    unsubscribe();
    registerErrorSink(added);
  });
  unsubscribe = registerErrorSink(removed);
  logError("Current", "storage");
  expect(removed).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ message: "Current" }));
  expect(added).not.toHaveBeenCalled();
  logError("Next", "battle");
  expect(removed).toHaveBeenCalledOnce();
  expect(added).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ message: "Next" }));
});
