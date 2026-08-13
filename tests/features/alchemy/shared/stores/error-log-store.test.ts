// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parsePersistedErrorLog, useErrorLogStore } from "@/features/alchemy/shared/stores/error-log-store";

const STORAGE_KEY = "alchemy-error-log";

describe("useErrorLogStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useErrorLogStore.setState({ errors: [] });
    vi.restoreAllMocks();
  });

  it("pushError appends an unreviewed entry with a unique id", () => {
    useErrorLogStore.getState().pushError({ message: "boom", source: "storage" });
    const errors = useErrorLogStore.getState().errors;
    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toBe("boom");
    expect(errors[0]?.reviewed).toBe(false);
    expect(errors[0]?.id).toMatch(/^err_/);
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

  it("markReviewed flips only the matching entry", () => {
    useErrorLogStore.getState().pushError({ message: "one", source: "storage" });
    useErrorLogStore.getState().pushError({ message: "two", source: "storage" });
    const firstId = useErrorLogStore.getState().errors[0]!.id;
    useErrorLogStore.getState().markReviewed(firstId);
    const errors = useErrorLogStore.getState().errors;
    expect(errors.find((entry) => entry.id === firstId)?.reviewed).toBe(true);
    expect(errors.find((entry) => entry.message === "two")?.reviewed).toBe(false);
  });

  it("clearErrors empties state and localStorage", () => {
    useErrorLogStore.getState().pushError({ message: "boom", source: "storage" });
    useErrorLogStore.getState().clearErrors();
    expect(useErrorLogStore.getState().errors).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("[]");
  });

  it("persists errors to localStorage", () => {
    useErrorLogStore.getState().pushError({ message: "persisted", source: "storage" });
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).toContain("persisted");
    const parsed = JSON.parse(raw ?? "[]") as Array<{ message: string }>;
    expect(parsed[0]?.message).toBe("persisted");
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
});
