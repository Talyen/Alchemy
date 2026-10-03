import { beforeEach, describe, expect, it, vi } from "vitest";
import { logError } from "@/lib/error-logger";
import {
  flushPersistedErrorLog,
  initErrorLogStore,
  parsePersistedErrorLog,
  useErrorLogStore,
} from "@/features/alchemy/shared/stores/error-log-store";

const STORAGE_KEY = "alchemy-error-log";

initErrorLogStore();

describe("useErrorLogStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useErrorLogStore.setState({ errors: [] });
    flushPersistedErrorLog();
    localStorage.clear();
  });

  it("caps stored errors at 100 entries", () => {
    for (let index = 0; index < 101; index += 1) {
      useErrorLogStore.getState().pushError({ message: `err-${index}`, source: "storage" });
    }
    const errors = useErrorLogStore.getState().errors;
    expect(errors).toHaveLength(100);
    expect(errors[0]?.message).toBe("err-1");
    expect(errors.at(-1)?.message).toBe("err-100");
  });

  it("clearErrors empties state and localStorage", () => {
    useErrorLogStore.getState().pushError({ message: "boom", source: "storage" });
    useErrorLogStore.getState().clearErrors();
    flushPersistedErrorLog();
    expect(useErrorLogStore.getState().errors).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("[]");
  });

  it.each(["not-json", "{}", "[null]", '[{"message":"missing required fields"}]'])(
    "recovers an empty list from corrupt persisted data: %s",
    (raw) => {
      expect(() => parsePersistedErrorLog(raw)).not.toThrow();
      expect(parsePersistedErrorLog(raw)).toEqual([]);
    },
  );

  it("keeps valid persisted entries while dropping malformed neighbors", () => {
    const valid = {
      id: "err_saved",
      timestamp: 123,
      message: "persisted",
      source: "storage",
      reviewed: true,
    };

    expect(parsePersistedErrorLog(JSON.stringify([null, valid, { ...valid, source: "unknown" }]))).toEqual([valid]);
  });

  it("receives entries reported through the shared error sink", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    logError("sink-wired", "other");
    expect(useErrorLogStore.getState().errors.at(-1)?.message).toBe("sink-wired");
    consoleSpy.mockRestore();
  });

  it("persists the batch when one entry carries an unserializable context", () => {
    const circular: Record<string, unknown> = { message: "circular" };
    circular.self = circular;
    useErrorLogStore.getState().pushError({ message: "poisoned", source: "storage", context: circular });
    useErrorLogStore.getState().pushError({ message: "healthy", source: "storage" });
    flushPersistedErrorLog();

    const parsed = parsePersistedErrorLog(localStorage.getItem(STORAGE_KEY));
    expect(parsed.map((entry) => entry.message)).toEqual(["poisoned", "healthy"]);
    expect(parsed[0]?.context).toBeUndefined();
  });

  it("serializes a stateful context once without losing neighboring entries", () => {
    const toJSON = vi.fn(() => {
      if (toJSON.mock.calls.length > 1) throw new Error("Context was serialized twice");
      return { detail: "snapshot" };
    });
    useErrorLogStore.getState().pushError({ message: "stateful", source: "storage", context: { toJSON } });
    useErrorLogStore.getState().pushError({ message: "healthy", source: "storage" });
    flushPersistedErrorLog();

    const parsed = parsePersistedErrorLog(localStorage.getItem(STORAGE_KEY));
    expect(parsed.map((entry) => entry.message)).toEqual(["stateful", "healthy"]);
    expect(parsed[0]?.context).toEqual({ detail: "snapshot" });
    expect(toJSON).toHaveBeenCalledTimes(1);
  });

  it("drops timestamps that cannot be rendered as dates", () => {
    const entry = { id: "err_saved", message: "bad time", source: "other", timestamp: 1e20 };
    expect(parsePersistedErrorLog(JSON.stringify([entry]))).toEqual([]);
  });

  it("normalizes optional fields and caps restored entries", () => {
    const entries = Array.from({ length: 101 }, (_, index) => ({
      id: `err_${index}`,
      timestamp: index,
      message: `message-${index}`,
      source: "other",
      reviewed: "yes",
      stack: 42,
    }));

    const parsed = parsePersistedErrorLog(JSON.stringify(entries));
    expect(parsed).toHaveLength(100);
    expect(parsed[0]?.id).toBe("err_1");
    expect(parsed.at(-1)).toMatchObject({ id: "err_100", reviewed: false });
    expect(parsed.at(-1)?.stack).toBeUndefined();
  });

  it("coalesces a burst into the latest snapshot and flushes it once before pagehide", () => {
    vi.useFakeTimers();
    const write = vi.spyOn(Storage.prototype, "setItem");
    try {
      useErrorLogStore.getState().pushError({ message: "first", source: "storage" });
      useErrorLogStore.getState().pushError({ message: "second", source: "storage" });
      const [first, second] = useErrorLogStore.getState().errors;
      expect(first!.id).not.toBe(second!.id);
      useErrorLogStore.getState().markReviewed(first!.id);
      vi.advanceTimersByTime(499);
      expect(write).not.toHaveBeenCalled();

      window.dispatchEvent(new Event("pagehide"));
      expect(parsePersistedErrorLog(localStorage.getItem(STORAGE_KEY))).toEqual(useErrorLogStore.getState().errors);
      expect(useErrorLogStore.getState().errors.map((error) => error.reviewed)).toEqual([true, false]);
      vi.advanceTimersByTime(500);
      flushPersistedErrorLog();
      expect(write).toHaveBeenCalledTimes(1);

      useErrorLogStore.getState().clearErrors();
      vi.advanceTimersByTime(500);
      expect(localStorage.getItem(STORAGE_KEY)).toBe("[]");
      expect(write).toHaveBeenCalledTimes(2);
    } finally {
      write.mockRestore();
      vi.useRealTimers();
    }
  });
});
