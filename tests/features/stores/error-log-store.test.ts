// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useErrorLogStore } from "@/features/alchemy/shared/stores/error-log-store";

const STORAGE_KEY = "alchemy-error-log";

describe("useErrorLogStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useErrorLogStore.setState({ errors: [] });
    vi.restoreAllMocks();
  });

  it("pushError appends an unreviewed entry with a unique id", () => {
    useErrorLogStore.getState().pushError({ message: "boom", source: "runtime" });
    const errors = useErrorLogStore.getState().errors;
    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toBe("boom");
    expect(errors[0]?.reviewed).toBe(false);
    expect(errors[0]?.id).toMatch(/^err_/);
  });

  it("caps stored errors at 100 entries", () => {
    for (let index = 0; index < 101; index += 1) {
      useErrorLogStore.getState().pushError({ message: `err-${index}`, source: "runtime" });
    }
    const errors = useErrorLogStore.getState().errors;
    expect(errors).toHaveLength(100);
    expect(errors[0]?.message).toBe("err-1");
    expect(errors.at(-1)?.message).toBe("err-100");
  });

  it("markReviewed flips only the matching entry", () => {
    useErrorLogStore.getState().pushError({ message: "one", source: "runtime" });
    useErrorLogStore.getState().pushError({ message: "two", source: "runtime" });
    const firstId = useErrorLogStore.getState().errors[0]!.id;
    useErrorLogStore.getState().markReviewed(firstId);
    const errors = useErrorLogStore.getState().errors;
    expect(errors.find((entry) => entry.id === firstId)?.reviewed).toBe(true);
    expect(errors.find((entry) => entry.message === "two")?.reviewed).toBe(false);
  });

  it("clearErrors empties state and localStorage", () => {
    useErrorLogStore.getState().pushError({ message: "boom", source: "runtime" });
    useErrorLogStore.getState().clearErrors();
    expect(useErrorLogStore.getState().errors).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("[]");
  });

  it("persists errors to localStorage", () => {
    useErrorLogStore.getState().pushError({ message: "persisted", source: "runtime" });
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).toContain("persisted");
    const parsed = JSON.parse(raw ?? "[]") as { message: string }[];
    expect(parsed[0]?.message).toBe("persisted");
  });
});
