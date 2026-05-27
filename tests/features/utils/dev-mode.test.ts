import { describe, expect, it, afterEach, vi, beforeEach } from "vitest";
import { isAlchemyDevBuild, shouldSkipStartupLoadingGate } from "@/features/alchemy/utils/dev-mode";

const SKIP_KEY = "alchemy-skip-loading-screen";

const storage = new Map<string, string>();

beforeEach(() => {
  storage.clear();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("shouldSkipStartupLoadingGate", () => {
  it("returns true for alchemy-skip-loading-screen", () => {
    storage.set(SKIP_KEY, "true");
    expect(shouldSkipStartupLoadingGate()).toBe(true);
  });

  it("returns false when skip key is absent", () => {
    expect(shouldSkipStartupLoadingGate()).toBe(false);
  });

  it("does not skip loading for alchemy-dev-mode alone", () => {
    storage.set("alchemy-dev-mode", "true");
    expect(shouldSkipStartupLoadingGate()).toBe(false);
  });
});

describe("isAlchemyDevBuild", () => {
  it("matches import.meta.env.DEV", () => {
    expect(isAlchemyDevBuild()).toBe(import.meta.env.DEV);
  });
});
