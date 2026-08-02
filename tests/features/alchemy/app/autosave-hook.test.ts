// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAlchemyAutosaveFromStores } from "@/app/use-app-save-state";
import { useRunDomainStore } from "../../../helpers/gameplay-store-test";

const mockStorage: Record<string, string> = {};

function setupLocalStorage() {
  const storage = {
    getItem: (key: string) => mockStorage[key] ?? null,
    setItem: (key: string, value: string) => {
      mockStorage[key] = value;
    },
    removeItem: (key: string) => {
      delete mockStorage[key];
    },
    clear: () => {
      Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
    },
    key: (index: number) => Object.keys(mockStorage)[index] ?? null,
    get length() {
      return Object.keys(mockStorage).length;
    },
  } as Storage;

  Object.defineProperty(window, "localStorage", { value: storage, configurable: true });
}

describe("useAlchemyAutosaveFromStores", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
    setupLocalStorage();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("writes debounced saves through storage io with lastSavedAt", async () => {
    renderHook(() => useAlchemyAutosaveFromStores(true));

    act(() => {
      useRunDomainStore.getState().setRunGold(77);
    });

    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    const keys = Object.keys(mockStorage);
    expect(keys.length).toBeGreaterThan(0);
    const written = JSON.parse(mockStorage[keys[0]!]);
    expect(written.lastSavedAt).toBeGreaterThan(0);
  });
});
